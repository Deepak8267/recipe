-- Profile table sync for World Recipes.
-- Run this in Supabase SQL Editor.

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles add column if not exists email text;
alter table profiles add column if not exists subscription_preview boolean not null default false;

alter table profiles enable row level security;

drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile"
on profiles for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own profile" on profiles;
create policy "Users can create own profile"
on profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
on profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    email,
    full_name,
    avatar_url,
    subscription_preview
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Recipe Lover'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'subscription_preview')::boolean, false)
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    subscription_preview = excluded.subscription_preview,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (
  user_id,
  email,
  full_name,
  avatar_url,
  subscription_preview
)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), 'Recipe Lover'),
  raw_user_meta_data->>'avatar_url',
  coalesce((raw_user_meta_data->>'subscription_preview')::boolean, false)
from auth.users
on conflict (user_id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  subscription_preview = excluded.subscription_preview,
  updated_at = now();
