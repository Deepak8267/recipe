import { recipes as localRecipes } from "../data/recipes";
import {
  getSupabaseHeaders,
  isSupabaseConfigured,
  supabaseUrl
} from "../lib/supabase";

const fallbackRecipeImage =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";

export async function getRecipes() {
  if (!isSupabaseConfigured) {
    return {
      recipes: localRecipes,
      source: "local"
    };
  }

  const select = [
    "id",
    "title",
    "region",
    "difficulty",
    "time_minutes",
    "servings",
    "image_url",
    "tags",
    "countries(name)",
    "recipe_ingredients(position,body)",
    "recipe_steps(position,body)"
  ].join(",");

  const response = await fetch(
    `${supabaseUrl}/rest/v1/recipes?select=${encodeURIComponent(
      select
    )}&is_published=eq.true&order=created_at.desc`,
    {
      headers: getSupabaseHeaders()
    }
  );

  if (!response.ok) {
    return {
      error: `Supabase request failed with status ${response.status}`,
      recipes: localRecipes,
      source: "local"
    };
  }

  const data = await response.json();

  return {
    recipes: data.map(mapRecipeFromSupabase),
    source: "supabase"
  };
}

function mapRecipeFromSupabase(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    country: recipe.countries?.name ?? "Unknown",
    region: recipe.region ?? "",
    timeMinutes: recipe.time_minutes,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    image: recipe.image_url || fallbackRecipeImage,
    tags: recipe.tags ?? [],
    ingredients: sortByPosition(recipe.recipe_ingredients),
    steps: sortByPosition(recipe.recipe_steps)
  };
}

function sortByPosition(items = []) {
  return [...items]
    .sort((first, second) => first.position - second.position)
    .map((item) => item.body);
}
