-- Mom's Perisa Phase 2: Kitchen profiles
-- Safe to run more than once.

alter table public.profiles
  add column if not exists kitchen_name text,
  add column if not exists kitchen_image_url text,
  add column if not exists kitchen_location text,
  add column if not exists kitchen_description text;

-- Keep kitchen profile text within reasonable limits.
alter table public.profiles
  drop constraint if exists profiles_kitchen_name_length,
  drop constraint if exists profiles_kitchen_location_length,
  drop constraint if exists profiles_kitchen_description_length;

alter table public.profiles
  add constraint profiles_kitchen_name_length
    check (kitchen_name is null or char_length(kitchen_name) <= 100),
  add constraint profiles_kitchen_location_length
    check (kitchen_location is null or char_length(kitchen_location) <= 150),
  add constraint profiles_kitchen_description_length
    check (kitchen_description is null or char_length(kitchen_description) <= 500);
