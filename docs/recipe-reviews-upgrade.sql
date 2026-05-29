create table if not exists recipe_reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, user_id)
);

alter table recipe_reviews enable row level security;

drop policy if exists "Published recipe reviews are readable" on recipe_reviews;
drop policy if exists "Users can create own recipe reviews" on recipe_reviews;
drop policy if exists "Users can update own recipe reviews" on recipe_reviews;
drop policy if exists "Users can delete own recipe reviews" on recipe_reviews;
drop policy if exists "Admins can manage recipe reviews" on recipe_reviews;

create policy "Published recipe reviews are readable"
  on recipe_reviews for select
  using (
    exists (
      select 1 from recipes
      where recipes.id = recipe_reviews.recipe_id
      and recipes.is_published = true
    )
  );

create policy "Users can create own recipe reviews"
  on recipe_reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own recipe reviews"
  on recipe_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own recipe reviews"
  on recipe_reviews for delete
  using (auth.uid() = user_id);

create policy "Admins can manage recipe reviews"
  on recipe_reviews for all
  using (is_admin())
  with check (is_admin());
