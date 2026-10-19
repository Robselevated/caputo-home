-- 2026-10-19 indexes and a server-side updated_at.
-- Found in the 2026-10-18 audit (docs/AUDIT-2026-10-18.md, Phase 3.4).
-- The cookbook grid reads recipes by household newest first, and the recently
-- bought list reads by household and bought_at; both get a matching index.
-- updated_at on grocery_items and inventory_items was only ever set by the
-- phone; a before-update trigger now stamps it on every update.
-- Run in the Supabase SQL editor. Safe to re-run. No data changes. Rollback:
--   drop trigger if exists grocery_items_updated_at on grocery_items;
--   drop trigger if exists inventory_items_updated_at on inventory_items;
--   drop function if exists set_updated_at();
--   drop index if exists idx_recipes_household_created;
--   drop index if exists idx_recently_bought_household_bought;

create index if not exists idx_recipes_household_created
  on recipes (household_id, created_at);
create index if not exists idx_recently_bought_household_bought
  on recently_bought (household_id, bought_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists grocery_items_updated_at on grocery_items;
create trigger grocery_items_updated_at
  before update on grocery_items
  for each row execute function set_updated_at();

drop trigger if exists inventory_items_updated_at on inventory_items;
create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function set_updated_at();

notify pgrst, 'reload schema';
