-- 2026-10-28 Date Night map: where each restaurant is, for the map pins.
-- Filled from Google Place Details when a place is added; places saved
-- before this are filled in once by the app the next time the tab opens.
-- Run in the Supabase SQL editor. Safe to re-run. No data changes. Rollback:
--   alter table restaurants drop column lat, drop column lng;

alter table restaurants add column if not exists lat double precision;
alter table restaurants add column if not exists lng double precision;

notify pgrst, 'reload schema';
