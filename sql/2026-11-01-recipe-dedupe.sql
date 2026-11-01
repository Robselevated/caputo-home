-- 2026-11-01 Remove duplicate recipes (S'mores Cups, Southwest Crock Pot
-- Chicken Tacos, and any other recipe saved twice). Two recipes are the same
-- when their names match ignoring case and extra spaces, the same rule the app
-- now uses to stop new copies.
--
-- Keeper per group: the copy with the most ingredients, then one with a
-- photo, then the oldest. Plan picks pointing at a removed copy are moved to
-- the keeper first, so nothing on the Planning tab loses its recipe.
--
-- Run in the Supabase SQL editor. Run step 0 alone first and check the list.
-- Safe to re-run. Rollback:
--   insert into recipes select * from recipes_backup_20261101 on conflict (id) do nothing;
--   insert into recipe_ingredients select * from recipe_ingredients_backup_20261101 on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 0. PREVIEW (read only): every duplicate group, keeper first
-- ---------------------------------------------------------------------------
with ranked as (
  select r.id, r.household_id, r.name, r.image_url is not null as has_photo, r.created_at,
         (select count(*) from recipe_ingredients i where i.recipe_id = r.id) as ingredients,
         lower(btrim(regexp_replace(r.name, '\s+', ' ', 'g'))) as name_key
    from recipes r
), grouped as (
  select *,
         count(*) over (partition by household_id, name_key) as copies,
         row_number() over (partition by household_id, name_key
                            order by ingredients desc, has_photo desc, created_at asc, id asc) as rank
    from ranked
)
select name, id, ingredients, has_photo, created_at,
       case when rank = 1 then 'KEEP' else 'remove' end as action
  from grouped
 where copies > 1
 order by name_key, rank;

-- ---------------------------------------------------------------------------
-- 1. BACKUP (only the copies that will be removed, plus their ingredients)
-- ---------------------------------------------------------------------------
create temp table recipe_dupes as
with ranked as (
  select r.id, r.household_id, r.image_url is not null as has_photo, r.created_at,
         (select count(*) from recipe_ingredients i where i.recipe_id = r.id) as ingredients,
         lower(btrim(regexp_replace(r.name, '\s+', ' ', 'g'))) as name_key
    from recipes r
), grouped as (
  select *,
         row_number() over (partition by household_id, name_key
                            order by ingredients desc, has_photo desc, created_at asc, id asc) as rank,
         first_value(id) over (partition by household_id, name_key
                               order by ingredients desc, has_photo desc, created_at asc, id asc) as keeper_id
    from ranked
)
select id as dupe_id, keeper_id from grouped where rank > 1;

create table if not exists recipes_backup_20261101 as
  select * from recipes where false;
insert into recipes_backup_20261101
  select r.* from recipes r join recipe_dupes d on d.dupe_id = r.id
  where not exists (select 1 from recipes_backup_20261101 b where b.id = r.id);

create table if not exists recipe_ingredients_backup_20261101 as
  select * from recipe_ingredients where false;
insert into recipe_ingredients_backup_20261101
  select i.* from recipe_ingredients i join recipe_dupes d on d.dupe_id = i.recipe_id
  where not exists (select 1 from recipe_ingredients_backup_20261101 b where b.id = i.id);

-- ---------------------------------------------------------------------------
-- 2. MOVE PLAN PICKS TO THE KEEPER, THEN DELETE THE COPIES
--    (recipe_ingredients go with them: on delete cascade)
-- ---------------------------------------------------------------------------
update meal_picks mp
   set recipe_id = d.keeper_id
  from recipe_dupes d
 where mp.recipe_id = d.dupe_id;

delete from recipes r
 using recipe_dupes d
 where r.id = d.dupe_id;

drop table recipe_dupes;

-- Expect no rows:
select household_id, lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) as name_key, count(*)
  from recipes
 group by 1, 2
having count(*) > 1;
