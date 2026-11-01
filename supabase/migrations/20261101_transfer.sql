-- 찜질중: 다른 기기에서 이어하기. The old device uploads a snapshot of its game data
-- with a 6-character code (10 minutes, single use); the new device claims it once.
-- No email or password: the code is the only key, and it expires quickly.
create table if not exists public.transfer_codes (
  code text primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
alter table public.transfer_codes enable row level security;
-- No direct table access; only the functions below.

create or replace function public.create_transfer_code(payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if me is null or payload is null or octet_length(payload::text) > 20000 then return null; end if;
  if (select count(*) from transfer_codes where owner = me and created_at > now() - interval '1 hour') >= 5 then return null; end if;
  delete from transfer_codes where created_at < now() - interval '1 day';
  loop
    c := ''; for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from transfer_codes where code = c);
  end loop;
  insert into transfer_codes(code, owner, data) values (c, me, payload);
  return c;
end $$;

create or replace function public.claim_transfer_code(transfer_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t transfer_codes;
begin
  if me is null then return null; end if;
  select * into t from transfer_codes where code = upper(transfer_code) and used_by is null and created_at > now() - interval '10 minutes' for update;
  if not found or t.owner = me then return null; end if;
  update transfer_codes set used_by = me, used_at = now() where code = t.code;
  return t.data;
end $$;

revoke execute on function public.create_transfer_code(jsonb), public.claim_transfer_code(text) from public, anon;
grant execute on function public.create_transfer_code(jsonb), public.claim_transfer_code(text) to authenticated;
