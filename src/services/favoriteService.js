import {
  getSupabaseHeaders,
  isSupabaseConfigured,
  supabaseUrl
} from "../lib/supabase";

const localFavoritesByUser = new Map();

export async function getFavoriteIds(session) {
  if (!session) {
    return [];
  }

  if (!isSupabaseConfigured || session.source === "local") {
    return [...(localFavoritesByUser.get(session.user.id) ?? new Set())];
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/favorite_recipes?select=recipe_id&user_id=eq.${encodeURIComponent(
      session.user.id
    )}`,
    {
      headers: getAuthedHeaders(session)
    }
  );

  if (!response.ok) {
    throw new Error(`Favorites request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.map((favorite) => favorite.recipe_id);
}

export async function saveFavorite(session, recipeId) {
  if (!session) {
    throw new Error("Login to save recipes.");
  }

  if (!isSupabaseConfigured || session.source === "local") {
    const favorites = getLocalFavoriteSet(session.user.id);
    favorites.add(recipeId);
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/favorite_recipes`, {
    method: "POST",
    headers: {
      ...getAuthedHeaders(session),
      Prefer: "resolution=ignore-duplicates"
    },
    body: JSON.stringify({
      user_id: session.user.id,
      recipe_id: recipeId
    })
  });

  if (!response.ok) {
    throw new Error(`Save favorite failed with status ${response.status}`);
  }
}

export async function removeFavorite(session, recipeId) {
  if (!session) {
    throw new Error("Login to manage saved recipes.");
  }

  if (!isSupabaseConfigured || session.source === "local") {
    const favorites = getLocalFavoriteSet(session.user.id);
    favorites.delete(recipeId);
    return;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/favorite_recipes?user_id=eq.${encodeURIComponent(
      session.user.id
    )}&recipe_id=eq.${encodeURIComponent(recipeId)}`,
    {
      method: "DELETE",
      headers: getAuthedHeaders(session)
    }
  );

  if (!response.ok) {
    throw new Error(`Remove favorite failed with status ${response.status}`);
  }
}

function getLocalFavoriteSet(userId) {
  if (!localFavoritesByUser.has(userId)) {
    localFavoritesByUser.set(userId, new Set());
  }

  return localFavoritesByUser.get(userId);
}

function getAuthedHeaders(session) {
  return {
    ...getSupabaseHeaders(),
    Authorization: `Bearer ${session.accessToken}`
  };
}
