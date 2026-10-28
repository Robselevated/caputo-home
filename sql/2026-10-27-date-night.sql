-- 2026-10-27 Date Night: a shared, reorderable list of restaurants to try,
-- and an archive of places we went with a score out of 10 per person and
-- bullet notes. Places come from Google Places (netlify/functions/places.js);
-- only the place id, name, food type, address and Maps link are stored.
-- Ratings and notes carry household_id so RLS and the realtime filter work
-- the same way as every other household table.
-- Run in the Supabase SQL editor. Safe to re-run. Rollback:
--   drop function if exists set_restaurant_sort_order(uuid[]);
--   drop table if exists restaurant_notes, restaurant_ratings, restaurants;

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  place_id text not null,
  name text not null,
  cuisine text,
  address text,
  maps_url text,
  status text not null default 'list' check (status in ('list', 'archived')),
  sort_order integer not null default 0,
  visited_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, place_id)
);

create table if not exists restaurant_ratings (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  score numeric(3,1) not null check (score >= 0 and score <= 10),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create table if not exists restaurant_notes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_restaurants_household on restaurants (household_id, status, sort_order);
create index if not exists idx_restaurant_ratings_household on restaurant_ratings (household_id);
create index if not exists idx_restaurant_notes_household on restaurant_notes (household_id, created_at);

alter table restaurants enable row level security;
alter table restaurant_ratings enable row level security;
alter table restaurant_notes enable row level security;

drop policy if exists "restaurants_all" on restaurants;
create policy "restaurants_all" on restaurants
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

-- A rating or note must point at a restaurant in the same household.
drop policy if exists "restaurant_ratings_all" on restaurant_ratings;
create policy "restaurant_ratings_all" on restaurant_ratings
  using (household_id = get_my_household_id())
  with check (
    household_id = get_my_household_id()
    and exists (select 1 from restaurants r where r.id = restaurant_id and r.household_id = get_my_household_id())
  );

drop policy if exists "restaurant_notes_all" on restaurant_notes;
create policy "restaurant_notes_all" on restaurant_notes
  using (household_id = get_my_household_id())
  with check (
    household_id = get_my_household_id()
    and exists (select 1 from restaurants r where r.id = restaurant_id and r.household_id = get_my_household_id())
  );

drop trigger if exists restaurants_updated_at on restaurants;
create trigger restaurants_updated_at
  before update on restaurants
  for each row execute function set_updated_at();

drop trigger if exists restaurant_ratings_updated_at on restaurant_ratings;
create trigger restaurant_ratings_updated_at
  before update on restaurant_ratings
  for each row execute function set_updated_at();

create or replace function set_restaurant_sort_order(p_ids uuid[])
returns void
language sql
security invoker
as $$
  update restaurants r
     set sort_order = u.ord - 1
    from unnest(p_ids) with ordinality as u(id, ord)
   where r.id = u.id;
$$;

revoke execute on function set_restaurant_sort_order(uuid[]) from public, anon;
grant  execute on function set_restaurant_sort_order(uuid[]) to authenticated;

alter table restaurants        replica identity full;
alter table restaurant_ratings replica identity full;
alter table restaurant_notes   replica identity full;

do $$
declare t text;
begin
  foreach t in array array['restaurants', 'restaurant_ratings', 'restaurant_notes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
