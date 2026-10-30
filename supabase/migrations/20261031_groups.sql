-- 찜질중: request-based group chat (README §6-C). Run once in the Supabase SQL Editor
-- of the 찜질중 project (xojeavzrmdizganxjygj). Requires Anonymous sign-ins (already on).
-- All limits are enforced here, not in the browser.

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 10),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
-- One group per visitor at a time.
create unique index if not exists group_members_one_group on public.group_members(user_id);

create table if not exists public.chat_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists chat_requests_pair on public.chat_requests(from_user, to_user, created_at desc);

create table if not exists public.blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked)
);

create table if not exists public.chat_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  no_requests boolean not null default false
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  reported uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.chat_groups(id) on delete set null,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

alter table public.chat_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.chat_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.chat_settings enable row level security;
alter table public.reports enable row level security;

-- Reads only; every write goes through the security-definer functions below.
create policy "members see their group" on public.group_members for select
  using (group_id in (select group_id from public.group_members where user_id = auth.uid()));
create policy "see own requests" on public.chat_requests for select
  using (from_user = auth.uid() or to_user = auth.uid());
create policy "own blocks" on public.blocks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own settings" on public.chat_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "file reports" on public.reports for insert with check (reporter = auth.uid());

-- Expire requests older than one minute (counted as a decline).
create or replace function public.expire_requests() returns void language sql security definer set search_path = public as $$
  update chat_requests set status = 'expired', answered_at = now()
  where status = 'pending' and created_at < now() - interval '1 minute';
$$;

-- Send a request. Returns 'sent' or a reason the sender sees only as "응답이 없어요".
create or replace function public.request_chat(target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); refusals int; my_group uuid; size int;
begin
  if me is null or target = me then return 'invalid'; end if;
  perform expire_requests();
  if (select count(*) from chat_requests where from_user = me and created_at > now() - interval '1 minute') >= 3 then return 'rate_limited'; end if;
  if exists (select 1 from blocks where (user_id = target and blocked = me) or (user_id = me and blocked = target)) then return 'unavailable'; end if;
  if exists (select 1 from chat_settings where user_id = target and no_requests) then return 'unavailable'; end if;
  -- Three refusals (declines or timeouts) within 10 minutes: wait; the count resets after 10 minutes.
  select count(*) into refusals from chat_requests
    where from_user = me and to_user = target and status in ('declined', 'expired') and answered_at > now() - interval '10 minutes';
  if refusals >= 3 then return 'cooling_down'; end if;
  if exists (select 1 from chat_requests where from_user = me and to_user = target and status = 'pending') then return 'pending'; end if;
  select group_id into my_group from group_members where user_id = me;
  if my_group is not null then
    select count(*) into size from group_members where group_id = my_group;
    if size >= 6 then return 'group_full'; end if;
  end if;
  insert into chat_requests(from_user, to_user) values (me, target);
  return 'sent';
end $$;

-- Answer a request addressed to me. Accepting puts both in one group (max 6).
create or replace function public.answer_chat(request uuid, accept boolean, my_name text, their_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r chat_requests; g uuid; size int;
begin
  perform expire_requests();
  select * into r from chat_requests where id = request and to_user = me and status = 'pending' for update;
  if not found then return null; end if;
  update chat_requests set status = case when accept then 'accepted' else 'declined' end, answered_at = now() where id = request;
  if not accept then return null; end if;
  select group_id into g from group_members where user_id = r.from_user;
  if g is null then insert into chat_groups default values returning id into g;
    insert into group_members(group_id, user_id, nickname) values (g, r.from_user, left(their_name, 10)); end if;
  select count(*) into size from group_members where group_id = g;
  if size >= 6 then return null; end if;
  delete from group_members where user_id = me;
  insert into group_members(group_id, user_id, nickname) values (g, me, left(my_name, 10));
  return g;
end $$;

-- Leave; the last member leaving removes the group.
create or replace function public.leave_group() returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  delete from group_members where user_id = auth.uid() returning group_id into g;
  if g is not null and not exists (select 1 from group_members where group_id = g) then delete from chat_groups where id = g; end if;
end $$;

-- Realtime private channels: only members may join `group:<id>`.
create policy "group members use their channel" on realtime.messages for all to authenticated
  using (realtime.topic() like 'group:%' and exists (select 1 from public.group_members where user_id = auth.uid() and 'group:' || group_id::text = realtime.topic()))
  with check (realtime.topic() like 'group:%' and exists (select 1 from public.group_members where user_id = auth.uid() and 'group:' || group_id::text = realtime.topic()));

grant execute on function public.request_chat(uuid), public.answer_chat(uuid, boolean, text, text), public.leave_group() to authenticated;
