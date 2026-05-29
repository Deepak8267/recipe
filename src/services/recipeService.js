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

  const selectWithPremium = [
    "id",
    "title",
    "region",
    "difficulty",
    "time_minutes",
    "servings",
    "image_url",
    "tags",
    "is_premium",
    "countries(name)",
    "categories(name)",
    "recipe_ingredients(position,body,name,quantity,unit,image_url)",
    "recipe_steps(position,body)"
  ].join(",");

  let response = await fetch(
    `${supabaseUrl}/rest/v1/recipes?select=${encodeURIComponent(
      selectWithPremium
    )}&is_published=eq.true&order=created_at.desc`,
    {
      headers: getSupabaseHeaders()
    }
  );

  if (!response.ok) {
    const fallbackSelect = [
      "id",
      "title",
      "region",
      "difficulty",
      "time_minutes",
      "servings",
      "image_url",
      "tags",
      "is_premium",
      "countries(name)",
      "recipe_ingredients(position,body)",
      "recipe_steps(position,body)"
    ].join(",");

    response = await fetch(
      `${supabaseUrl}/rest/v1/recipes?select=${encodeURIComponent(
        fallbackSelect
      )}&is_published=eq.true&order=created_at.desc`,
      {
        headers: getSupabaseHeaders()
      }
    );
  }

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
    category: recipe.categories?.name ?? inferCategory(recipe.tags),
    region: recipe.region ?? "",
    timeMinutes: recipe.time_minutes,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    image: recipe.image_url || fallbackRecipeImage,
    isPremium: Boolean(recipe.is_premium),
    tags: recipe.tags ?? [],
    ingredients: sortIngredients(recipe.recipe_ingredients),
    steps: sortByPosition(recipe.recipe_steps)
  };
}

function inferCategory(tags = []) {
  const knownCategories = ["Breakfast", "Lunch", "Dinner", "Desserts", "Healthy", "Vegetarian"];
  return knownCategories.find((category) => tags.includes(category)) ?? "Dinner";
}

function sortIngredients(items = []) {
  return [...items].sort((first, second) => first.position - second.position).map((item) => {
    if (!item.name && !item.quantity && !item.unit && !item.image_url) {
      return item.body;
    }

    return {
      body: item.body,
      image: item.image_url,
      name: item.name || item.body,
      quantity: item.quantity || "",
      unit: item.unit || ""
    };
  });
}

function sortByPosition(items = []) {
  return [...items]
    .sort((first, second) => first.position - second.position)
    .map((item) => item.body);
}
