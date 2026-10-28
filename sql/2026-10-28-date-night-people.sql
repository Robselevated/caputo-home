-- 2026-10-28 Date Night scores belong to a person slot (Rob, Cheyene), not a
-- login, so both scores always have a place even if one of us entered both.
-- user_id stays as "who typed it". Existing scores are matched to a person
-- by the user's email or name.
-- Run in the Supabase SQL editor. Safe to re-run. Rollback:
--   alter table restaurant_ratings drop constraint restaurant_ratings_pkey;
--   alter table restaurant_ratings add primary key (restaurant_id, user_id);
--   alter table restaurant_ratings drop column person;

alter table restaurant_ratings add column if not exists person text;

update restaurant_ratings rr
   set person = case
                  when lower(u.email) like 'caputochey%' or lower(u.name) like 'chey%' then 'cheyene'
                  else 'rob'
                end
  from users u
 where u.id = rr.user_id
   and rr.person is null;

update restaurant_ratings set person = 'rob' where person is null;

alter table restaurant_ratings alter column person set not null;
alter table restaurant_ratings drop constraint if exists restaurant_ratings_person_check;
alter table restaurant_ratings add constraint restaurant_ratings_person_check check (person in ('rob', 'cheyene'));

-- If two old rows map to the same person, keep the newest.
delete from restaurant_ratings a
 using restaurant_ratings b
 where a.restaurant_id = b.restaurant_id
   and a.person = b.person
   and a.updated_at < b.updated_at;

alter table restaurant_ratings drop constraint if exists restaurant_ratings_pkey;
alter table restaurant_ratings add primary key (restaurant_id, person);
alter table restaurant_ratings alter column user_id drop not null;
alter table restaurant_ratings drop constraint if exists restaurant_ratings_user_id_fkey;
alter table restaurant_ratings add constraint restaurant_ratings_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

notify pgrst, 'reload schema';
