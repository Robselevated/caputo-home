-- 2026-11-01 The Kitchen lists only what we have. From now on a row that hits
-- zero is deleted by the app; this clears the "Out" rows left from before.
-- Run in the Supabase SQL editor, step 0 first to see what goes. Safe to re-run.
-- Rollback:
--   insert into inventory_items select * from inventory_items_backup_20261101
--     on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 0. PREVIEW (read only)
-- ---------------------------------------------------------------------------
select location, count(*), array_agg(name order by name) as names
  from inventory_items
 where qty <= 0
 group by location;

-- ---------------------------------------------------------------------------
-- 1. BACKUP
-- ---------------------------------------------------------------------------
create table if not exists inventory_items_backup_20261101 as
  select * from inventory_items where qty <= 0;

-- ---------------------------------------------------------------------------
-- 2. DELETE
-- ---------------------------------------------------------------------------
delete from inventory_items where qty <= 0;
