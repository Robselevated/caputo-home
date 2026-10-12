-- 2026-10-12 recipe import hardening
-- Replace a recipe's ingredients in one statement so an edit or re-import can
-- never leave the recipe half-saved (the app used to delete, then insert).
-- Run in the Supabase SQL editor. Rollback:
--   drop function if exists replace_recipe_ingredients(uuid, jsonb);
-- The app falls back to insert-then-delete while the function is missing.

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
