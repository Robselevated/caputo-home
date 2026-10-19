-- 2026-10-19 rate limit: reserve a use in one statement.
-- Found in the 2026-10-18 audit (docs/AUDIT-2026-10-18.md, Phase 3.3).
-- checkRateLimit counted rows and then inserted one, so parallel requests all
-- passed the count. reserve_api_usage takes a per-user, per-action advisory
-- lock, counts the last hour and inserts in the same transaction.
-- The functions fall back to the old count-then-insert while this is missing
-- (PostgREST PGRST202), so deploy order does not matter.
-- The api_usage table itself was never created in the live database (checked
-- 2026-10-19), so the hourly limits failed open and allowed every call. It is
-- created here first.
-- Run in the Supabase SQL editor. Safe to re-run. No data changes. Rollback:
--   drop function if exists reserve_api_usage(uuid, text, integer);
--   drop table if exists api_usage;

create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  action text not null,
  created_at timestamptz default now()
);
create index if not exists idx_api_usage_user_action on api_usage(user_id, action, created_at);
alter table api_usage enable row level security;  -- service role only, no policies

create or replace function reserve_api_usage(p_user uuid, p_action text, p_max integer)
returns table (allowed boolean, used integer, usage_id uuid)
language plpgsql
set search_path = public
as $$
declare
  v_used integer;
  v_id uuid;
begin
  if p_user is null or p_action is null or p_max is null then
    raise exception 'reserve_api_usage: user, action and max are required';
  end if;

  -- Held until the calling statement's transaction ends, so a second request
  -- for the same user and action waits here and then sees this row.
  perform pg_advisory_xact_lock(hashtextextended('api_usage:' || p_user::text || ':' || p_action, 0));

  -- Keep the table small without pg_cron: drop this user's day-old rows.
  delete from api_usage
   where user_id = p_user and action = p_action
     and created_at < now() - interval '1 day';

  select count(*) into v_used
    from api_usage
   where user_id = p_user
     and action = p_action
     and created_at >= now() - interval '1 hour';

  if v_used >= p_max then
    return query select false, v_used, null::uuid;
    return;
  end if;

  insert into api_usage (user_id, action) values (p_user, p_action) returning id into v_id;
  return query select true, v_used, v_id;
end $$;

-- Netlify functions call this with the service role only.
revoke execute on function reserve_api_usage(uuid, text, integer) from public, anon, authenticated;
grant  execute on function reserve_api_usage(uuid, text, integer) to service_role;

notify pgrst, 'reload schema';
