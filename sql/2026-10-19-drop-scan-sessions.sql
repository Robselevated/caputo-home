-- 2026-10-19 cleanup: drop scan_sessions.
-- Found in the 2026-10-18 audit (docs/AUDIT-2026-10-18.md, Phase 4). The
-- table has 0 rows and no code reads or writes it: scans go straight from the
-- photo to the review sheet. Its scan_type check also rejected 'fridge' and
-- 'receipt_inventory', which the scanner sends today.
-- Run in the Supabase SQL editor. Safe to re-run. Rollback: re-run the
-- scan_sessions block that was in schema.sql before this change (git history).

drop table if exists scan_sessions;

notify pgrst, 'reload schema';
