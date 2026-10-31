-- 찜질중: only signed-in visitors (including anonymous sign-ins, role `authenticated`)
-- may call the group-chat functions. Postgres grants EXECUTE to PUBLIC by default,
-- which let the `anon` role call them (they already refused without auth.uid()).
revoke execute on function public.request_chat(uuid), public.answer_chat(uuid, boolean, text, text), public.leave_group(), public.expire_requests() from public, anon;
grant execute on function public.request_chat(uuid), public.answer_chat(uuid, boolean, text, text), public.leave_group() to authenticated;
-- expire_requests is only called from inside the other functions.
revoke execute on function public.expire_requests() from authenticated;
