create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

alter table recipes
  add column if not exists category_id uuid references categories(id) on delete set null;

alter table recipe_ingredients add column if not exists name text;
alter table recipe_ingredients add column if not exists quantity text;
alter table recipe_ingredients add column if not exists unit text;
alter table recipe_ingredients add column if not exists image_url text;

insert into categories (name)
values
  ('Breakfast'),
  ('Lunch'),
  ('Dinner'),
  ('Desserts'),
  ('Healthy'),
  ('Vegetarian')
on conflict (name) do nothing;

drop policy if exists "Categories are readable" on categories;
drop policy if exists "Admins can create categories" on categories;
drop policy if exists "Admins can update categories" on categories;

create policy "Categories are readable"
  on categories for select
  using (true);

create policy "Admins can create categories"
  on categories for insert
  with check (is_admin());

create policy "Admins can update categories"
  on categories for update
  using (is_admin())
  with check (is_admin());
