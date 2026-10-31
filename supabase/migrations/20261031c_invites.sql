-- 찜질중: one-time invite tokens. A Kakao invite link carries a token; opening it
-- joins the inviter's group (the link click counts as accepting). Max 6 members.
create table if not exists public.invites (
  token text primary key,
  inviter uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
alter table public.invites enable row level security;
create policy "see own invites" on public.invites for select using (inviter = auth.uid());

-- Issue a token (valid 24 h, single use). Creates a group for the inviter when needed.
create or replace function public.create_invite(my_name text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g uuid; t text;
begin
  if me is null then return null; end if;
  if (select count(*) from invites where inviter = me and created_at > now() - interval '1 hour') >= 10 then return null; end if;
  select group_id into g from group_members where user_id = me;
  if g is null then
    insert into chat_groups default values returning id into g;
    insert into group_members(group_id, user_id, nickname) values (g, me, left(my_name, 10));
  end if;
  t := encode(gen_random_bytes(12), 'hex');
  insert into invites(token, inviter) values (t, me);
  return t;
end $$;

-- Redeem: joins the inviter's current group. Returns the group id, or null.
create or replace function public.redeem_invite(invite_token text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); i invites; g uuid; size int;
begin
  if me is null then return null; end if;
  select * into i from invites where token = invite_token and used_by is null and created_at > now() - interval '24 hours' for update;
  if not found or i.inviter = me then return null; end if;
  if exists (select 1 from blocks where (user_id = i.inviter and blocked = me) or (user_id = me and blocked = i.inviter)) then return null; end if;
  select group_id into g from group_members where user_id = i.inviter;
  if g is null then return null; end if;
  select count(*) into size from group_members where group_id = g;
  if size >= 6 then return null; end if;
  delete from group_members where user_id = me;
  insert into group_members(group_id, user_id, nickname) values (g, me, left(my_name, 10));
  update invites set used_by = me, used_at = now() where token = invite_token;
  return g;
end $$;

revoke execute on function public.create_invite(text), public.redeem_invite(text, text) from public, anon;
grant execute on function public.create_invite(text), public.redeem_invite(text, text) to authenticated;
