-- Run this script in Supabase Dashboard > SQL Editor.
-- Authentication users are managed by Supabase Auth (auth.users).
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  make text check (make is null or length(make) <= 60),
  model text check (model is null or length(model) <= 60),
  year smallint check (year is null or year between 1950 and 2100),
  plate text check (plate is null or length(plate) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 100),
  last_service_date date not null,
  interval_days integer not null check (interval_days between 1 and 36500),
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_records_owned_car_fk foreign key (car_id, owner_id)
    references public.cars(id, owner_id) on delete cascade
);

create index if not exists cars_owner_created_idx on public.cars(owner_id, created_at desc);
create index if not exists maintenance_owner_car_idx on public.maintenance_records(owner_id, car_id);
create index if not exists maintenance_owner_date_idx on public.maintenance_records(owner_id, last_service_date desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists cars_set_updated_at on public.cars;
create trigger cars_set_updated_at before update on public.cars for each row execute function public.set_updated_at();
drop trigger if exists maintenance_set_updated_at on public.maintenance_records;
create trigger maintenance_set_updated_at before update on public.maintenance_records for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.maintenance_records enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "cars_select_own" on public.cars;
create policy "cars_select_own" on public.cars for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "cars_insert_own" on public.cars;
create policy "cars_insert_own" on public.cars for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "cars_update_own" on public.cars;
create policy "cars_update_own" on public.cars for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "cars_delete_own" on public.cars;
create policy "cars_delete_own" on public.cars for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "maintenance_select_own" on public.maintenance_records;
create policy "maintenance_select_own" on public.maintenance_records for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "maintenance_insert_owned_car" on public.maintenance_records;
create policy "maintenance_insert_owned_car" on public.maintenance_records for insert to authenticated
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.cars c where c.id = car_id and c.owner_id = (select auth.uid())
));
drop policy if exists "maintenance_update_owned_car" on public.maintenance_records;
create policy "maintenance_update_owned_car" on public.maintenance_records for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.cars c where c.id = car_id and c.owner_id = (select auth.uid())
));
drop policy if exists "maintenance_delete_own" on public.maintenance_records;
create policy "maintenance_delete_own" on public.maintenance_records for delete to authenticated using ((select auth.uid()) = owner_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cars, public.maintenance_records to authenticated;
grant select on public.profiles to authenticated;
