-- 2026-10-12 freshness check: a stock clock on inventory_items.
-- stocked_at moves only when a row is created or its quantity goes up, so
-- every restock path (merge, scan, check-off, offline replay) resets it with
-- no app change. checked_at is set when someone confirms an item is still good.
-- Run in the Supabase SQL editor. Rollback:
--   drop trigger if exists inventory_items_stock_clock on inventory_items;
--   drop function if exists inventory_items_stock_clock();
--   alter table inventory_items drop column if exists stocked_at, drop column if exists checked_at;

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
