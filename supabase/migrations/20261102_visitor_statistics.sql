-- Anonymous visitor statistics for the public sauna.
-- Both tables contain only auth user UUIDs (no birth dates, messages, IPs,
-- nicknames or browser fingerprints). There are intentionally no RLS policies:
-- the public API exposes only aggregated counts via fixed, parameterless RPCs.
-- The functions are security-definer by design, check auth.uid(), take no
-- caller-controlled IDs and never return individual identifiers.
-- Statistics begin when this migration + frontend recording are deployed.
create table if not exists public.visitor_first_seen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_seen timestamptz not null default now()
);
create table if not exists public.visitor_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_day date not null,
  primary key (user_id, visit_day)
);
create index if not exists visitor_days_day_idx on public.visitor_days (visit_day);
alter table public.visitor_first_seen enable row level security;
alter table public.visitor_days enable row level security;
revoke all on public.visitor_first_seen, public.visitor_days from public, anon, authenticated;

create or replace function public.get_visit_stats()
returns table (today_count bigint, total_count bigint, counted_day date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
begin
  if (select auth.uid()) is null then
    raise exception 'Anonymous session required' using errcode = '28000';
  end if;
  return query select
    (select count(*) from public.visitor_days v where v.visit_day = today_kst),
    (select count(*) from public.visitor_first_seen),
    today_kst;
end;
$$;

create or replace function public.record_visit()
returns table (today_count bigint, total_count bigint, counted_day date)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  visitor uuid := (select auth.uid());
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
begin
  if visitor is null then
    raise exception 'Anonymous session required' using errcode = '28000';
  end if;
  insert into public.visitor_first_seen (user_id) values (visitor)
    on conflict (user_id) do nothing;
  insert into public.visitor_days (user_id, visit_day) values (visitor, today_kst)
    on conflict (user_id, visit_day) do nothing;
  return query select
    (select count(*) from public.visitor_days v where v.visit_day = today_kst),
    (select count(*) from public.visitor_first_seen),
    today_kst;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default. Restrict these intentionally
-- exposed aggregate-only endpoints to a real Supabase session, including guests.
revoke execute on function public.get_visit_stats() from public, anon, authenticated;
revoke execute on function public.record_visit() from public, anon, authenticated;
grant execute on function public.get_visit_stats() to authenticated;
grant execute on function public.record_visit() to authenticated;
comment on function public.record_visit() is 'Aggregate-only public guest visit counter, at most once per Supabase user per KST day; no personal data returned.';
comment on function public.get_visit_stats() is 'Returns only aggregate unique guest accounts since tracking began.';
