-- 2026-11-01 Planning week calendar. A pick with planned_for set sits on that
-- day; null keeps it in Rob's or Cheyene's list. One dinner per day.
-- Run in the Supabase SQL editor BEFORE the app update deploys. Safe to re-run.
-- Rollback:
--   drop index if exists meal_picks_one_per_day;
--   alter table meal_picks drop column if exists planned_for;

alter table meal_picks add column if not exists planned_for date;

create unique index if not exists meal_picks_one_per_day
  on meal_picks (household_id, planned_for)
  where planned_for is not null;
