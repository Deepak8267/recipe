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

alter table countries enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table favorite_recipes enable row level security;

create policy "Published countries are readable"
  on countries for select
  using (true);

create policy "Published recipes are readable"
  on recipes for select
  using (is_published = true);

create policy "Recipe ingredients are readable"
  on recipe_ingredients for select
  using (
    exists (
      select 1 from recipes
      where recipes.id = recipe_ingredients.recipe_id
      and recipes.is_published = true
    )
  );

create policy "Recipe steps are readable"
  on recipe_steps for select
  using (
    exists (
      select 1 from recipes
      where recipes.id = recipe_steps.recipe_id
      and recipes.is_published = true
    )
  );

create policy "Users can read own favorites"
  on favorite_recipes for select
  using (auth.uid() = user_id);

create policy "Users can add own favorites"
  on favorite_recipes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own favorites"
  on favorite_recipes for delete
  using (auth.uid() = user_id);
