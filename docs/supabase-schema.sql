create table countries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete restrict,
  title text not null,
  region text,
  difficulty text not null,
  time_minutes integer not null,
  servings integer not null,
  image_url text,
  tags text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position integer not null,
  body text not null
);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position integer not null,
  body text not null
);

create table favorite_recipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update set public = true;

alter table countries enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table favorite_recipes enable row level security;
alter table profiles enable row level security;
alter table admins enable row level security;

create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from admins
    where admins.user_id = auth.uid()
  );
$$;

create policy "Published countries are readable"
  on countries for select
  using (true);

create policy "Admins can create countries"
  on countries for insert
  with check (is_admin());

create policy "Admins can update countries"
  on countries for update
  using (is_admin())
  with check (is_admin());

create policy "Published recipes are readable"
  on recipes for select
  using (is_published = true);

create policy "Admins can read all recipes"
  on recipes for select
  using (is_admin());

create policy "Admins can create recipes"
  on recipes for insert
  with check (is_admin());

create policy "Admins can update recipes"
  on recipes for update
  using (is_admin())
  with check (is_admin());

create policy "Recipe ingredients are readable"
  on recipe_ingredients for select
  using (
    exists (
      select 1 from recipes
      where recipes.id = recipe_ingredients.recipe_id
      and recipes.is_published = true
    )
  );

create policy "Admins can manage recipe ingredients"
  on recipe_ingredients for all
  using (is_admin())
  with check (is_admin());

create policy "Recipe steps are readable"
  on recipe_steps for select
  using (
    exists (
      select 1 from recipes
      where recipes.id = recipe_steps.recipe_id
      and recipes.is_published = true
    )
  );

create policy "Admins can manage recipe steps"
  on recipe_steps for all
  using (is_admin())
  with check (is_admin());

create policy "Users can read own favorites"
  on favorite_recipes for select
  using (auth.uid() = user_id);

create policy "Users can add own favorites"
  on favorite_recipes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own favorites"
  on favorite_recipes for delete
  using (auth.uid() = user_id);

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = user_id);

create policy "Users can create own profile"
  on profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins can read admin list"
  on admins for select
  using (is_admin());

create policy "Recipe images are public"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

create policy "Admins can upload recipe images"
  on storage.objects for insert
  with check (bucket_id = 'recipe-images' and is_admin());

create policy "Admins can update recipe images"
  on storage.objects for update
  using (bucket_id = 'recipe-images' and is_admin())
  with check (bucket_id = 'recipe-images' and is_admin());

create policy "Admins can delete recipe images"
  on storage.objects for delete
  using (bucket_id = 'recipe-images' and is_admin());
