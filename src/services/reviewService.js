import {
  getSupabaseHeaders,
  isSupabaseConfigured,
  supabaseUrl
} from "../lib/supabase";

const localReviewsByRecipe = new Map();

export async function getRecipeReviews(recipeId) {
  if (!isSupabaseConfigured) {
    return getLocalReviews(recipeId);
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/recipe_reviews?select=id,recipe_id,user_id,rating,comment,created_at&recipe_id=eq.${encodeURIComponent(
      recipeId
    )}&order=created_at.desc`,
    {
      headers: getSupabaseHeaders()
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.map(mapReview);
}

export async function saveRecipeReview({ session, recipeId, rating, comment }) {
  if (!session) {
    throw new Error("Login to review this recipe.");
  }

  const cleanComment = comment.trim();

  if (!rating || rating < 1 || rating > 5) {
    throw new Error("Choose a rating from 1 to 5.");
  }

  if (!isSupabaseConfigured || session.source === "local") {
    return saveLocalReview({ session, recipeId, rating, comment: cleanComment });
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/recipe_reviews?on_conflict=recipe_id,user_id`,
    {
      method: "POST",
      headers: {
        ...getAuthedHeaders(session),
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        comment: cleanComment,
        rating,
        recipe_id: recipeId,
        user_id: session.user.id
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Save review failed with status ${response.status}`);
  }

  const data = await response.json();
  return {
    ...mapReview(data[0]),
    userName: session.user.fullName
  };
}

function getLocalReviews(recipeId) {
  return [...(localReviewsByRecipe.get(recipeId) ?? [])];
}

function saveLocalReview({ session, recipeId, rating, comment }) {
  const reviews = getLocalReviews(recipeId);
  const existingIndex = reviews.findIndex((review) => review.userId === session.user.id);
  const review = {
    comment,
    createdAt: new Date().toISOString(),
    id: `${recipeId}-${session.user.id}`,
    rating,
    recipeId,
    userId: session.user.id,
    userName: session.user.fullName
  };

  if (existingIndex >= 0) {
    reviews[existingIndex] = review;
  } else {
    reviews.unshift(review);
  }

  localReviewsByRecipe.set(recipeId, reviews);
  return review;
}

function mapReview(review) {
  return {
    comment: review.comment ?? "",
    createdAt: review.created_at,
    id: review.id,
    rating: review.rating,
    recipeId: review.recipe_id,
    userId: review.user_id,
    userName: review.userName || "Recipe Lover"
  };
}

function getAuthedHeaders(session) {
  return {
    ...getSupabaseHeaders(),
    Authorization: `Bearer ${session.accessToken}`
  };
}
