-- 2026-10-19 security: close open signup, lock household_id, pin search_path.
-- Found in the 2026-10-18 audit (docs/AUDIT-2026-10-18.md, Phase 1).
-- Run in the Supabase SQL editor. Safe to re-run. Rollback:
--   drop table if exists allowed_signups;
--   (then re-run the handle_new_user / users_update_own blocks from schema.sql
--    as they were before this file)

-- 1. Signup allowlist ------------------------------------------------------
-- The anon key can call auth.signUp, and handle_new_user put every new
-- account straight into the Caputo household. Only emails listed here may
-- now create an account. Seeded from the accounts that already exist, so
-- nobody who signs in today is affected.
-- To let someone new in:  insert into allowed_signups (email) values ('them@example.com');
create table if not exists allowed_signups (
  email text primary key check (email = lower(email))
);
alter table allowed_signups enable row level security;  -- no policies: service role and SQL editor only

insert into allowed_signups (email)
  select lower(email) from auth.users where email is not null
  on conflict do nothing;

create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  household uuid;
begin
  if not exists (select 1 from allowed_signups where email = lower(new.email)) then
    raise exception 'Sign up is invite only';
  end if;

  select id into household from households where name = 'Caputo Family' limit 1;
  if household is null then
    insert into households (name) values ('Caputo Family') returning id into household;
  end if;

  insert into public.users (id, household_id, name, email)
  values (
    new.id,
    household,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );

  return new;
end;
$$;

-- 2. Users cannot move themselves into another household -------------------
-- The old policy had no WITH CHECK, so a signed-in user could set their own
-- household_id to any UUID and read that household's data.
drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users
  for update using (id = auth.uid())
  with check (id = auth.uid() and household_id is not distinct from get_my_household_id());

-- 3. Pin search_path on the other security definer helper -------------------
create or replace function get_my_household_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select household_id from users where id = auth.uid();
$$;

-- 4. Notification queue: RLS is already on in the live database (checked
-- 2026-10-19: anon reads 0 of 239 rows, anon insert is refused). This line
-- makes schema.sql match so a rebuild keeps it.
alter table grocery_notifications enable row level security;

-- 5. Prune the notification queue (send-push now clears only what it sent).
delete from grocery_notifications where created_at < now() - interval '1 day';
