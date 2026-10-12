-- ============================================================
-- CAPUTO HOUSEHOLD APP — SUPABASE SCHEMA
-- ============================================================

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id) on delete set null,
  name text not null,
  email text not null,
  push_subscription jsonb,         -- Web Push API subscription object
  last_notified_at timestamptz,    -- debounce: last time this user was sent a push
  created_at timestamptz default now()
);

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- When someone signs up via magic link, auto-create a row in
-- the users table and assign to the Caputo household.
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
declare
  household uuid;
begin
  -- Get or create the Caputo household
  select id into household from households where name = 'Caputo Family' limit 1;
  if household is null then
    insert into households (name) values ('Caputo Family') returning id into household;
  end if;

  -- Create user profile linked to household
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- ITEM HISTORY (autocomplete source — never auto-deleted)
-- ============================================================
create table item_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  constraint item_history_household_name_unique unique (household_id, name)
);

-- ============================================================
-- GROCERY ITEMS (offline-first — synced flag tracks pending writes)
-- ============================================================
create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  qty numeric,
  unit text,
  store text,                      -- 'Pilgrams' | 'Costco' | 'Store' | custom string
  notes text,                      -- substitution notes, reminders, etc
  checked boolean default false,
  checked_at timestamptz,
  sort_order integer default 0,
  added_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz default now(),
  synced boolean default true,     -- false = written offline, not yet pushed to Supabase
  created_at timestamptz default now()
);

-- ============================================================
-- RECENTLY BOUGHT
-- Auto-delete rows older than 90 days via pg_cron (see bottom of file)
-- ============================================================
create table recently_bought (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  qty numeric,
  unit text,
  store text,
  notes text,
  bought_at timestamptz default now(),
  bought_by uuid references users(id) on delete set null
);

-- ============================================================
-- INVENTORY ITEMS
-- location: freezer | pantry | fridge | home_goods
-- category + subcategory structure defined in taxonomy below
-- subcategory is NULL for flat categories (most pantry items)
-- ============================================================
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  qty numeric default 0,
  unit text,
  -- unit smart defaults by location:
  --   freezer meats = 'lbs'
  --   freezer other = 'bags' | 'packages' | 'count'
  --   pantry = 'cans' | 'boxes' | 'bags' | 'jars' | 'count'
  --   fridge = 'count' | 'packages' | 'lbs'
  location text not null check (location in ('freezer', 'pantry', 'fridge', 'home_goods')),
  category text not null,
  subcategory text,                -- null for flat categories
  notes text,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- SCAN SESSIONS
-- Stores photo scan attempts so user can review before confirming
-- scan_type: 'pantry' | 'freezer' | 'receipt'
-- status: 'pending_review' -> 'confirmed' | 'cancelled'
-- ============================================================
create table scan_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  scan_type text not null check (scan_type in ('pantry', 'freezer', 'receipt')),
  image_url text,                  -- stored in Supabase Storage bucket
  raw_result jsonb,                -- full Claude Vision structured response
  confirmed_items jsonb,           -- items user approved after review
  status text not null default 'pending_review'
    check (status in ('pending_review', 'confirmed', 'cancelled')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- GROCERY NOTIFICATION QUEUE (batched push notifications)
-- ============================================================
create table grocery_notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  changed_by uuid references users(id) on delete set null,
  action text not null,              -- 'added', 'checked_off', 'removed'
  item_name text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- RECIPES
-- ============================================================
create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  description text,
  servings integer,
  prep_time integer,               -- minutes
  cook_time integer,               -- minutes
  tags text[],                     -- e.g. ['Mexican', 'Quick meals', "Cheyenne's picks"]
  instructions text,               -- full step-by-step as formatted text
  image_url text,                  -- finished dish display image
  source_image_url text,           -- uploaded recipe source image (cookbook page, card, screenshot)
  source_url text,                 -- original URL if imported
  notes text,                      -- user notes / modifications / tips
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- RECIPE INGREDIENTS
-- ============================================================
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  name text not null,              -- must match inventory_items.name exactly (case-insensitive)
  qty numeric,                     -- numeric value for math (e.g. "Make This" inventory decrement)
  qty_text text,                   -- verbatim quantity as typed for display ("1/2", "to taste")
  unit text,
  notes text,                      -- substitution notes per ingredient
  section text,                    -- ingredient group heading (e.g. 'Sauce', 'Chicken', 'Green Sauce')
  position integer default 0       -- display order within recipe
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_grocery_items_household on grocery_items(household_id);
create index idx_grocery_items_checked on grocery_items(checked);
create index idx_recently_bought_household on recently_bought(household_id);
create index idx_recently_bought_bought_at on recently_bought(bought_at);
create index idx_inventory_items_household on inventory_items(household_id);
create index idx_inventory_items_location on inventory_items(location);
create index idx_inventory_items_category on inventory_items(category);
create index idx_item_history_household on item_history(household_id);
create index idx_recipes_household on recipes(household_id);
create index idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id);
create index idx_scan_sessions_household on scan_sessions(household_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- All tables scoped to household_id of the authenticated user
-- ============================================================
alter table households enable row level security;
alter table users enable row level security;
alter table item_history enable row level security;
alter table grocery_items enable row level security;
alter table recently_bought enable row level security;
alter table inventory_items enable row level security;
alter table scan_sessions enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;

-- Helper function: get household_id for current user
create or replace function get_my_household_id()
returns uuid
language sql security definer
as $$
  select household_id from users where id = auth.uid();
$$;

-- Households: can only see your own
create policy "households_select" on households
  for select using (id = get_my_household_id());

-- Users: can see users in same household
create policy "users_select" on users
  for select using (household_id = get_my_household_id());

create policy "users_update_own" on users
  for update using (id = auth.uid());

-- Generic household-scoped policy helper for all other tables
-- (applied individually below)

create policy "grocery_items_all" on grocery_items
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

create policy "recently_bought_all" on recently_bought
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

create policy "item_history_all" on item_history
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

create policy "inventory_items_all" on inventory_items
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

create policy "scan_sessions_all" on scan_sessions
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

create policy "recipes_all" on recipes
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

create policy "recipe_ingredients_all" on recipe_ingredients
  using (
    recipe_id in (
      select id from recipes where household_id = get_my_household_id()
    )
  )
  with check (
    recipe_id in (
      select id from recipes where household_id = get_my_household_id()
    )
  );

-- ============================================================
-- AUTO-DELETE RECENTLY BOUGHT (older than 90 days)
-- Requires pg_cron extension enabled in Supabase dashboard
-- ============================================================
select cron.schedule(
  'delete-old-recently-bought',
  '0 3 * * *',  -- runs daily at 3am UTC
  $$
    delete from recently_bought
    where bought_at < now() - interval '90 days';
  $$
);

-- ============================================================
-- REALTIME: enable on tables that need live sync
-- ============================================================
alter publication supabase_realtime add table grocery_items;
alter publication supabase_realtime add table inventory_items;
alter publication supabase_realtime add table recently_bought;
alter publication supabase_realtime add table recipes;

-- ============================================================
-- MEAL PICKS (weekly meal planning per household member)
-- ============================================================
create table meal_picks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  recipe_id uuid references recipes(id) on delete set null,
  name text not null,
  notes text,
  image_url text,
  section text default 'Rob''s Picks',  -- named section grouping
  created_at timestamptz default now()
);

create index idx_meal_picks_household on meal_picks(household_id);

alter table meal_picks enable row level security;

create policy "meal_picks_all" on meal_picks
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

alter publication supabase_realtime add table meal_picks;

-- ============================================================
-- API USAGE (rate limiting for Netlify Functions)
-- Tracks per-user API calls per action per hour
-- ============================================================
create table api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  action text not null,
  created_at timestamptz default now()
);

create index idx_api_usage_user_action on api_usage(user_id, action, created_at);

alter table api_usage enable row level security;
-- No RLS policies needed — this table is only accessed via service role key from Netlify functions

-- Auto-delete old rate limit records (older than 24 hours) to keep table small
select cron.schedule(
  'delete-old-api-usage',
  '0 4 * * *',  -- runs daily at 4am UTC
  $$
    delete from api_usage
    where created_at < now() - interval '24 hours';
  $$
);

-- ============================================================
-- SUPABASE STORAGE BUCKET
-- Create manually in dashboard or via this:
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('scan-images', 'scan-images', false);

-- ===========================================================================
-- 2026-10-11 hardening (see sql/2026-10-11-hardening.sql for the migration
-- with backup + dedupe steps). Fresh installs get the end state here.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- 3. NORMALIZED KEY + UNIQUENESS
-- ---------------------------------------------------------------------------
alter table inventory_items
  add column if not exists name_key text
  generated always as (lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))) stored;

create unique index if not exists inventory_items_hh_loc_namekey_uidx
  on inventory_items (household_id, location, name_key);

-- ---------------------------------------------------------------------------
-- 4. REALTIME: full old row on DELETE/UPDATE, and publish recipe_ingredients
-- ---------------------------------------------------------------------------
alter table grocery_items      replica identity full;
alter table inventory_items    replica identity full;
alter table recently_bought    replica identity full;
alter table recipes            replica identity full;
alter table meal_picks         replica identity full;
alter table recipe_ingredients replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'recipe_ingredients') then
    alter publication supabase_realtime add table recipe_ingredients;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. FUNCTIONS (security invoker: RLS still applies to the caller)
-- ---------------------------------------------------------------------------
create or replace function merge_inventory_item(
  p_household_id uuid,
  p_name         text,
  p_qty          numeric,
  p_unit         text,
  p_location     text,
  p_category     text,
  p_subcategory  text default null,
  p_notes        text default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row    inventory_items;
  v_key    text := lower(btrim(regexp_replace(p_name, '\s+', ' ', 'g')));
  v_merged boolean := false;
begin
  select * into v_row
    from inventory_items
   where household_id = p_household_id
     and location = p_location
     and name_key = v_key
   order by created_at
   limit 1
   for update;

  if found then
    update inventory_items
       set qty        = coalesce(qty, 0) + coalesce(p_qty, 1),
           unit       = coalesce(unit, p_unit),
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_row.id
     returning * into v_row;
    v_merged := true;
  else
    begin
      insert into inventory_items
        (household_id, name, qty, unit, location, category, subcategory, notes, updated_by)
      values
        (p_household_id, btrim(p_name), coalesce(p_qty, 1), p_unit, p_location,
         p_category, p_subcategory, p_notes, auth.uid())
      returning * into v_row;
    exception when unique_violation then
      -- lost a race with the other phone: fold into the row that won
      update inventory_items
         set qty        = coalesce(qty, 0) + coalesce(p_qty, 1),
             unit       = coalesce(unit, p_unit),
             updated_by = auth.uid(),
             updated_at = now()
       where household_id = p_household_id
         and location = p_location
         and name_key = v_key
       returning * into v_row;
      v_merged := true;
    end;
  end if;

  return jsonb_build_object('merged', v_merged, 'item', to_jsonb(v_row));
end
$$;

create or replace function check_off_grocery_item(
  p_item_id  uuid,
  p_location text,
  p_category text,
  p_unit     text
) returns jsonb
language plpgsql
security invoker
as $$
declare
  g   grocery_items;
  inv jsonb;
begin
  select * into g from grocery_items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  insert into recently_bought (household_id, name, qty, unit, store, notes, bought_by)
  values (g.household_id, g.name, g.qty, g.unit, g.store, g.notes, auth.uid());

  insert into item_history (household_id, name)
  values (g.household_id, g.name)
  on conflict (household_id, name) do nothing;

  inv := merge_inventory_item(
           g.household_id, g.name, coalesce(g.qty, 1), coalesce(g.unit, p_unit),
           p_location, p_category);

  delete from grocery_items where id = g.id;

  return jsonb_build_object('status', 'ok', 'inventory', inv);
end
$$;

create or replace function set_grocery_sort_order(p_ids uuid[])
returns void
language sql
security invoker
as $$
  update grocery_items g
     set sort_order = u.ord - 1,
         updated_by = auth.uid(),
         updated_at = now()
    from unnest(p_ids) with ordinality as u(id, ord)
   where g.id = u.id;
$$;

revoke execute on function merge_inventory_item(uuid,text,numeric,text,text,text,text,text) from public, anon;
revoke execute on function check_off_grocery_item(uuid,text,text,text) from public, anon;
revoke execute on function set_grocery_sort_order(uuid[]) from public, anon;
grant  execute on function merge_inventory_item(uuid,text,numeric,text,text,text,text,text) to authenticated;
grant  execute on function check_off_grocery_item(uuid,text,text,text) to authenticated;
grant  execute on function set_grocery_sort_order(uuid[]) to authenticated;

notify pgrst, 'reload schema';


-- ------------------------------------------------------------
-- 2026-10-12: replace a recipe's ingredients atomically (see sql/2026-10-12-recipe-import.sql)
-- ------------------------------------------------------------
create or replace function replace_recipe_ingredients(p_recipe_id uuid, p_rows jsonb)
returns setof recipe_ingredients
language plpgsql
security invoker
as $$
begin
  -- Row-level security on recipes decides whether the caller may touch it.
  if not exists (select 1 from recipes where id = p_recipe_id) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  delete from recipe_ingredients where recipe_id = p_recipe_id;
  return query
    insert into recipe_ingredients (recipe_id, name, qty, qty_text, unit, notes, section, position)
    select p_recipe_id, r.name, r.qty, r.qty_text, r.unit, r.notes, r.section, coalesce(r.position, 0)
    from jsonb_to_recordset(p_rows)
      as r(name text, qty numeric, qty_text text, unit text, notes text, section text, position int)
    where r.name is not null and btrim(r.name) <> ''
    returning *;
end $$;

revoke execute on function replace_recipe_ingredients(uuid, jsonb) from public, anon;
grant execute on function replace_recipe_ingredients(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 2026-10-12: freshness stock clock (see sql/2026-10-12-freshness.sql)
-- ------------------------------------------------------------
alter table inventory_items
  add column if not exists stocked_at timestamptz default now(),
  add column if not exists checked_at timestamptz;

-- The add column filled existing rows with the migration time; use their history.
update inventory_items set stocked_at = coalesce(updated_at, created_at);

create or replace function inventory_items_stock_clock()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.stocked_at is null then new.stocked_at := now(); end if;
  elsif coalesce(new.qty, 0) > coalesce(old.qty, 0)
        and new.stocked_at is not distinct from old.stocked_at then
    new.stocked_at := now();
  end if;
  return new;
end $$;

drop trigger if exists inventory_items_stock_clock on inventory_items;
create trigger inventory_items_stock_clock
  before insert or update on inventory_items
  for each row execute function inventory_items_stock_clock();

notify pgrst, 'reload schema';
