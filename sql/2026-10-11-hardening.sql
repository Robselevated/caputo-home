-- Caputo Home — inventory hardening, 2026-10-11
-- Run in the Supabase SQL editor as the project owner, top to bottom.
-- Step 0 is read-only. Step 1 backs up. Step 2 merges duplicate rows. Steps 3-5 are schema.
-- Rollback (if needed):
--   drop index if exists inventory_items_hh_loc_namekey_uidx;
--   alter table inventory_items drop column if exists name_key;
--   alter table <t> replica identity default;  -- per table
--   drop function if exists check_off_grocery_item(uuid,text,text,text);
--   drop function if exists merge_inventory_item(uuid,text,numeric,text,text,text,text,text);
--   drop function if exists set_grocery_sort_order(uuid[]);
--   -- restore rows: insert into inventory_items select * from inventory_items_backup_20261011 on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 0. VERIFY FIRST (read-only)
-- ---------------------------------------------------------------------------
select id, household_id, name, email from public.users;                          -- both users share household_id?
select tablename, policyname, cmd from pg_policies where schemaname = 'public'
  order by 1, 2;                                                                 -- inventory_items_all must be cmd = ALL
select relname, relreplident from pg_class
  where relname in ('grocery_items','inventory_items','recently_bought','recipes','meal_picks','recipe_ingredients');
                                                                                 -- expect 'd' (default) before, 'f' after
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
select household_id, location,
       lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) as name_key,
       count(*), array_agg(name), array_agg(qty)
  from inventory_items
 group by 1, 2, 3
having count(*) > 1;                                                             -- duplicates that step 2 merges

-- ---------------------------------------------------------------------------
-- 1. BACKUP
-- ---------------------------------------------------------------------------
create table if not exists inventory_items_backup_20261011 as select * from inventory_items;

-- ---------------------------------------------------------------------------
-- 2. DEDUPE per (household, location, normalized name): keep oldest row, sum qty
-- ---------------------------------------------------------------------------
begin;
with ranked as (
  select id,
         first_value(id) over (
           partition by household_id, location, lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))
           order by created_at, id) as keep_id,
         sum(coalesce(qty, 0)) over (
           partition by household_id, location, lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))) as total_qty
    from inventory_items)
update inventory_items i
   set qty = r.total_qty
  from ranked r
 where i.id = r.id and r.id = r.keep_id;

with ranked as (
  select id,
         first_value(id) over (
           partition by household_id, location, lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))
           order by created_at, id) as keep_id
    from inventory_items)
delete from inventory_items i
 using ranked r
 where i.id = r.id and r.id <> r.keep_id;
commit;

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

revoke execute on function merge_inventory_item(uuid,text,numeric,text,text,text,text,text) from anon;
revoke execute on function check_off_grocery_item(uuid,text,text,text) from anon;
revoke execute on function set_grocery_sort_order(uuid[]) from anon;
grant  execute on function merge_inventory_item(uuid,text,numeric,text,text,text,text,text) to authenticated;
grant  execute on function check_off_grocery_item(uuid,text,text,text) to authenticated;
grant  execute on function set_grocery_sort_order(uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 6. RE-VERIFY: re-run the step 0 queries. Expect relreplident = 'f' for all
--    six tables, recipe_ingredients in the publication, and 0 duplicate rows.
-- ---------------------------------------------------------------------------
