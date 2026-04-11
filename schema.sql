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
  qty numeric,
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

