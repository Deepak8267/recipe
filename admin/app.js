const config = window.WORLD_RECIPES_ADMIN_CONFIG || {};
const state = {
  accessToken: "",
  editingRecipeId: "",
  user: null
};

const elements = {
  setupPanel: document.querySelector("#setupPanel"),
  loginPanel: document.querySelector("#loginPanel"),
  recipePanel: document.querySelector("#recipePanel"),
  managePanel: document.querySelector("#managePanel"),
  reviewsPanel: document.querySelector("#reviewsPanel"),
  logoutButton: document.querySelector("#logoutButton"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginButton: document.querySelector("#loginButton"),
  loginStatus: document.querySelector("#loginStatus"),
  sessionText: document.querySelector("#sessionText"),
  recipeFormTitle: document.querySelector("#recipeFormTitle"),
  titleInput: document.querySelector("#titleInput"),
  countryInput: document.querySelector("#countryInput"),
  categoryInput: document.querySelector("#categoryInput"),
  regionInput: document.querySelector("#regionInput"),
  difficultyInput: document.querySelector("#difficultyInput"),
  timeInput: document.querySelector("#timeInput"),
  servingsInput: document.querySelector("#servingsInput"),
  imageFileInput: document.querySelector("#imageFileInput"),
  imageInput: document.querySelector("#imageInput"),
  tagsInput: document.querySelector("#tagsInput"),
  ingredientsInput: document.querySelector("#ingredientsInput"),
  stepsInput: document.querySelector("#stepsInput"),
  publishedInput: document.querySelector("#publishedInput"),
  premiumInput: document.querySelector("#premiumInput"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  saveButton: document.querySelector("#saveButton"),
  refreshButton: document.querySelector("#refreshButton"),
  refreshReviewsButton: document.querySelector("#refreshReviewsButton"),
  recipeList: document.querySelector("#recipeList"),
  reviewList: document.querySelector("#reviewList"),
  recipeStatus: document.querySelector("#recipeStatus")
};

const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

if (isConfigured) {
  elements.setupPanel.classList.add("hidden");
} else {
  elements.loginPanel.classList.add("hidden");
}

elements.loginButton.addEventListener("click", handleLogin);
elements.logoutButton.addEventListener("click", handleLogout);
elements.saveButton.addEventListener("click", handleSaveRecipe);
elements.cancelEditButton.addEventListener("click", clearRecipeForm);
elements.refreshButton.addEventListener("click", loadRecipeList);
elements.refreshReviewsButton.addEventListener("click", loadReviewList);

async function handleLogin() {
  setStatus(elements.loginStatus, "");
  elements.loginButton.disabled = true;

  try {
    const response = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: {
        email: elements.emailInput.value.trim().toLowerCase(),
        password: elements.passwordInput.value
      }
    });

    state.accessToken = response.access_token;
    state.editingRecipeId = "";
    state.user = response.user;
    elements.sessionText.textContent = `Logged in as ${state.user.email}`;
    elements.loginPanel.classList.add("hidden");
    elements.recipePanel.classList.remove("hidden");
    elements.managePanel.classList.remove("hidden");
    elements.reviewsPanel.classList.remove("hidden");
    elements.logoutButton.classList.remove("hidden");
    await loadRecipeList();
    await loadReviewList();
  } catch (error) {
    setStatus(elements.loginStatus, error.message, "error");
  } finally {
    elements.loginButton.disabled = false;
  }
}

function handleLogout() {
  state.accessToken = "";
  state.editingRecipeId = "";
  state.user = null;
  elements.passwordInput.value = "";
  elements.recipePanel.classList.add("hidden");
  elements.managePanel.classList.add("hidden");
  elements.reviewsPanel.classList.add("hidden");
  elements.logoutButton.classList.add("hidden");
  elements.loginPanel.classList.remove("hidden");
  elements.recipeList.innerHTML = "";
  elements.reviewList.innerHTML = "";
}

async function handleSaveRecipe() {
  setStatus(elements.recipeStatus, "");
  elements.saveButton.disabled = true;

  try {
    const ingredients = getIngredientLines(elements.ingredientsInput.value);
    const steps = getLines(elements.stepsInput.value);

    if (!elements.titleInput.value.trim() || !elements.countryInput.value.trim()) {
      throw new Error("Recipe title and country are required.");
    }

    if (!ingredients.length || !steps.length) {
      throw new Error("Add at least one ingredient and one cooking step.");
    }

    setStatus(
      elements.recipeStatus,
      state.editingRecipeId ? "Updating recipe..." : "Uploading recipe...",
      ""
    );
    const country = await findOrCreateCountry(elements.countryInput.value.trim());
    const category = await findOrCreateCategory(elements.categoryInput.value);
    const imageUrl = await getRecipeImageUrl();

    if (state.editingRecipeId) {
      await updateRecipe(state.editingRecipeId, country.id, category.id, imageUrl);
      await replaceRecipeLines("recipe_ingredients", state.editingRecipeId, ingredients);
      await replaceRecipeLines("recipe_steps", state.editingRecipeId, steps);
    } else {
      const recipe = await createRecipe(country.id, category.id, imageUrl);
      await createRecipeLines("recipe_ingredients", recipe.id, ingredients);
      await createRecipeLines("recipe_steps", recipe.id, steps);
    }

    clearRecipeForm();
    setStatus(elements.recipeStatus, "Recipe saved successfully.", "success");
    await loadRecipeList();
  } catch (error) {
    setStatus(elements.recipeStatus, error.message, "error");
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function loadRecipeList() {
  elements.recipeList.innerHTML = '<p class="muted">Loading recipes...</p>';

  try {
    const select = [
      "id",
      "title",
      "is_published",
      "is_premium",
      "time_minutes",
      "servings",
      "created_at",
      "countries(name)",
      "categories(name)"
    ].join(",");
    const recipes = await request(
      `/rest/v1/recipes?select=${encodeURIComponent(select)}&order=created_at.desc`,
      {
        authed: true
      }
    );

    renderRecipeList(recipes);
  } catch (error) {
    elements.recipeList.innerHTML = `<p class="status error">${escapeHtml(
      error.message
    )}</p>`;
  }
}

async function loadReviewList() {
  elements.reviewList.innerHTML = '<p class="muted">Loading reviews...</p>';

  try {
    const select = [
      "id",
      "rating",
      "comment",
      "created_at",
      "user_id",
      "recipes(title,countries(name))"
    ].join(",");
    const reviews = await request(
      `/rest/v1/recipe_reviews?select=${encodeURIComponent(
        select
      )}&order=created_at.desc&limit=50`,
      {
        authed: true
      }
    );

    renderReviewList(reviews);
  } catch (error) {
    elements.reviewList.innerHTML = `<p class="status error">${escapeHtml(
      error.message
    )}</p>`;
  }
}

function renderReviewList(reviews) {
  if (!reviews.length) {
    elements.reviewList.innerHTML = '<p class="muted">No reviews yet.</p>';
    return;
  }

  elements.reviewList.innerHTML = reviews
    .map(
      (review) => `
        <article class="recipeRow reviewRow">
          <div>
            <h3>${escapeHtml(review.recipes?.title || "Unknown recipe")}</h3>
            <p>${escapeHtml(review.recipes?.countries?.name || "Unknown country")} - ${
        review.rating
      }/5 - ${formatDate(review.created_at)}</p>
            <p class="reviewComment">${escapeHtml(review.comment || "No comment")}</p>
            <span class="badge draft">User ${escapeHtml(shortId(review.user_id))}</span>
          </div>
          <div class="recipeActions">
            <button
              class="danger"
              type="button"
              data-review-action="delete"
              data-id="${review.id}"
            >
              Delete review
            </button>
          </div>
        </article>
      `
    )
    .join("");

  elements.reviewList.querySelectorAll("button[data-review-action]").forEach((button) => {
    button.addEventListener("click", () => handleReviewAction(button));
  });
}

async function handleReviewAction(button) {
  const reviewId = button.dataset.id;
  const action = button.dataset.reviewAction;
  button.disabled = true;

  try {
    if (action === "delete") {
      const confirmed = window.confirm("Delete this review?");
      if (!confirmed) {
        button.disabled = false;
        return;
      }

      await deleteReview(reviewId);
    }

    await loadReviewList();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
}

function renderRecipeList(recipes) {
  if (!recipes.length) {
    elements.recipeList.innerHTML = '<p class="muted">No recipes uploaded yet.</p>';
    return;
  }

  elements.recipeList.innerHTML = recipes
    .map(
      (recipe) => `
        <article class="recipeRow">
          <div>
            <h3>${escapeHtml(recipe.title)}</h3>
            <p>${escapeHtml(recipe.countries?.name || "Unknown")} - ${escapeHtml(
        recipe.categories?.name || "Uncategorized"
      )} - ${
        recipe.time_minutes
      } min - Serves ${recipe.servings}</p>
            <span class="${recipe.is_published ? "badge published" : "badge draft"}">
              ${recipe.is_published ? "Published" : "Draft"}
            </span>
            <span class="${recipe.is_premium ? "badge premium" : "badge free"}">
              ${recipe.is_premium ? "Premium" : "Free"}
            </span>
          </div>
          <div class="recipeActions">
            <button
              class="secondary"
              type="button"
              data-action="edit"
              data-id="${recipe.id}"
            >
              Edit
            </button>
            <button
              class="secondary"
              type="button"
              data-action="premium"
              data-id="${recipe.id}"
              data-premium="${recipe.is_premium}"
            >
              ${recipe.is_premium ? "Make Free" : "Make Premium"}
            </button>
            <button
              class="secondary"
              type="button"
              data-action="toggle"
              data-id="${recipe.id}"
              data-published="${recipe.is_published}"
            >
              ${recipe.is_published ? "Unpublish" : "Publish"}
            </button>
            <button
              class="danger"
              type="button"
              data-action="delete"
              data-id="${recipe.id}"
            >
              Delete
            </button>
          </div>
        </article>
      `
    )
    .join("");

  elements.recipeList.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleRecipeAction(button));
  });
}

async function handleRecipeAction(button) {
  const recipeId = button.dataset.id;
  const action = button.dataset.action;
  button.disabled = true;

  try {
    if (action === "edit") {
      await loadRecipeForEdit(recipeId);
      button.disabled = false;
      return;
    }

    if (action === "toggle") {
      const nextPublished = button.dataset.published !== "true";
      await updateRecipePublishStatus(recipeId, nextPublished);
    }

    if (action === "premium") {
      const nextPremium = button.dataset.premium !== "true";
      await updateRecipePremiumStatus(recipeId, nextPremium);
    }

    if (action === "delete") {
      const confirmed = window.confirm("Delete this recipe?");
      if (!confirmed) {
        button.disabled = false;
        return;
      }

      await deleteRecipe(recipeId);
    }

    await loadRecipeList();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
}

async function updateRecipePublishStatus(recipeId, isPublished) {
  await request(`/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}`, {
    method: "PATCH",
    authed: true,
    body: {
      is_published: isPublished
    }
  });
}

async function updateRecipePremiumStatus(recipeId, isPremium) {
  await request(`/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}`, {
    method: "PATCH",
    authed: true,
    body: {
      is_premium: isPremium
    }
  });
}

async function loadRecipeForEdit(recipeId) {
  const select = [
    "id",
    "title",
    "region",
    "difficulty",
    "time_minutes",
    "servings",
    "image_url",
    "tags",
    "is_published",
    "is_premium",
    "countries(name)",
    "categories(name)",
    "recipe_ingredients(position,body,name,quantity,unit,image_url)",
    "recipe_steps(position,body)"
  ].join(",");

  const recipes = await request(
    `/rest/v1/recipes?select=${encodeURIComponent(select)}&id=eq.${encodeURIComponent(
      recipeId
    )}`,
    {
      authed: true
    }
  );

  if (!recipes.length) {
    throw new Error("Recipe not found.");
  }

  populateRecipeForm(recipes[0]);
  elements.recipePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function updateRecipe(recipeId, countryId, categoryId, imageUrl) {
  const tags = getTags();

  await request(`/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}`, {
    method: "PATCH",
    authed: true,
    body: {
      category_id: categoryId,
      country_id: countryId,
      difficulty: elements.difficultyInput.value,
      image_url: imageUrl,
      is_premium: elements.premiumInput.checked,
      is_published: elements.publishedInput.checked,
      region: elements.regionInput.value.trim(),
      servings: Number(elements.servingsInput.value),
      tags,
      time_minutes: Number(elements.timeInput.value),
      title: elements.titleInput.value.trim()
    }
  });
}

async function deleteRecipe(recipeId) {
  await request(`/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}`, {
    method: "DELETE",
    authed: true
  });
}

async function deleteReview(reviewId) {
  await request(`/rest/v1/recipe_reviews?id=eq.${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
    authed: true
  });
}

async function findOrCreateCountry(countryName) {
  const existing = await request(
    `/rest/v1/countries?select=id,name&name=eq.${encodeURIComponent(countryName)}`,
    {
      authed: true
    }
  );

  if (existing.length) {
    return existing[0];
  }

  const created = await request("/rest/v1/countries", {
    method: "POST",
    authed: true,
    prefer: "return=representation",
    body: {
      name: countryName
    }
  });

  return created[0];
}

async function findOrCreateCategory(categoryName) {
  const existing = await request(
    `/rest/v1/categories?select=id,name&name=eq.${encodeURIComponent(categoryName)}`,
    {
      authed: true
    }
  );

  if (existing.length) {
    return existing[0];
  }

  const created = await request("/rest/v1/categories", {
    method: "POST",
    authed: true,
    prefer: "return=representation",
    body: {
      name: categoryName
    }
  });

  return created[0];
}

async function getRecipeImageUrl() {
  const imageFile = elements.imageFileInput.files[0];

  if (!imageFile) {
    return elements.imageInput.value.trim();
  }

  if (!imageFile.type.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }

  const filePath = `${Date.now()}-${slugify(imageFile.name)}`;
  const response = await fetch(
    `${config.supabaseUrl}/storage/v1/object/recipe-images/${filePath}`,
    {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${state.accessToken}`,
        "Content-Type": imageFile.type,
        "x-upsert": "false"
      },
      body: imageFile
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Image upload failed with status ${response.status}`);
  }

  return `${config.supabaseUrl}/storage/v1/object/public/recipe-images/${filePath}`;
}

async function createRecipe(countryId, categoryId, imageUrl) {
  const tags = getTags();

  const created = await request("/rest/v1/recipes", {
    method: "POST",
    authed: true,
    prefer: "return=representation",
    body: {
      country_id: countryId,
      category_id: categoryId,
      title: elements.titleInput.value.trim(),
      region: elements.regionInput.value.trim(),
      difficulty: elements.difficultyInput.value,
      time_minutes: Number(elements.timeInput.value),
      servings: Number(elements.servingsInput.value),
      image_url: imageUrl,
      tags,
      is_published: elements.publishedInput.checked,
      is_premium: elements.premiumInput.checked
    }
  });

  return created[0];
}

async function replaceRecipeLines(tableName, recipeId, lines) {
  await request(
    `/rest/v1/${tableName}?recipe_id=eq.${encodeURIComponent(recipeId)}`,
    {
      method: "DELETE",
      authed: true
    }
  );

  await createRecipeLines(tableName, recipeId, lines);
}

async function createRecipeLines(tableName, recipeId, lines) {
  const body = lines.map((line, index) => ({
    recipe_id: recipeId,
    position: index + 1,
    body: line.body || line,
    name: line.name,
    quantity: line.quantity,
    unit: line.unit,
    image_url: line.imageUrl
  }));

  try {
    await request(`/rest/v1/${tableName}`, {
      method: "POST",
      authed: true,
      body
    });
  } catch (error) {
    if (tableName !== "recipe_ingredients") {
      throw error;
    }

    await request(`/rest/v1/${tableName}`, {
      method: "POST",
      authed: true,
      body: body.map((line) => ({
        recipe_id: line.recipe_id,
        position: line.position,
        body: line.body
      }))
    });
  }
}

async function request(path, options = {}) {
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: options.authed
      ? `Bearer ${state.accessToken}`
      : `Bearer ${config.supabaseAnonKey}`,
    "Content-Type": "application/json"
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || text);
  }

  return data;
}

function getLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getIngredientLines(value) {
  return getLines(value).map((line) => {
    const [name, quantity = "", unit = "", imageUrl = ""] = line
      .split("|")
      .map((part) => part.trim());

    return {
      body: [quantity, unit, name].filter(Boolean).join(" "),
      imageUrl,
      name,
      quantity,
      unit
    };
  });
}

function getTags() {
  return elements.tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function populateRecipeForm(recipe) {
  state.editingRecipeId = recipe.id;
  elements.recipeFormTitle.textContent = "Edit recipe";
  elements.cancelEditButton.classList.remove("hidden");
  elements.saveButton.textContent = "Update recipe";
  elements.titleInput.value = recipe.title || "";
  elements.countryInput.value = recipe.countries?.name || "";
  elements.categoryInput.value = recipe.categories?.name || "Dinner";
  elements.regionInput.value = recipe.region || "";
  elements.difficultyInput.value = recipe.difficulty || "Medium";
  elements.timeInput.value = recipe.time_minutes || "30";
  elements.servingsInput.value = recipe.servings || "2";
  elements.imageFileInput.value = "";
  elements.imageInput.value = recipe.image_url || "";
  elements.tagsInput.value = (recipe.tags || []).join(", ");
  elements.ingredientsInput.value = formatIngredientLines(recipe.recipe_ingredients);
  elements.stepsInput.value = formatStepLines(recipe.recipe_steps);
  elements.publishedInput.checked = Boolean(recipe.is_published);
  elements.premiumInput.checked = Boolean(recipe.is_premium);
  setStatus(elements.recipeStatus, "Editing existing recipe.", "");
}

function formatIngredientLines(ingredients = []) {
  return [...ingredients]
    .sort((first, second) => first.position - second.position)
    .map((ingredient) => {
      if (ingredient.name || ingredient.quantity || ingredient.unit || ingredient.image_url) {
        return [
          ingredient.name || ingredient.body,
          ingredient.quantity || "",
          ingredient.unit || "",
          ingredient.image_url || ""
        ].join(" | ");
      }

      return ingredient.body;
    })
    .join("\n");
}

function formatStepLines(steps = []) {
  return [...steps]
    .sort((first, second) => first.position - second.position)
    .map((step) => step.body)
    .join("\n");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }

  return new Date(value).toLocaleDateString();
}

function shortId(value) {
  if (!value) {
    return "unknown";
  }

  return `${value.slice(0, 8)}...`;
}

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.classList.remove("success", "error");

  if (type) {
    element.classList.add(type);
  }
}

function clearRecipeForm() {
  state.editingRecipeId = "";
  elements.recipeFormTitle.textContent = "New recipe";
  elements.cancelEditButton.classList.add("hidden");
  elements.saveButton.textContent = "Save recipe";
  elements.titleInput.value = "";
  elements.countryInput.value = "";
  elements.categoryInput.value = "Dinner";
  elements.regionInput.value = "";
  elements.timeInput.value = "30";
  elements.servingsInput.value = "2";
  elements.imageFileInput.value = "";
  elements.imageInput.value = "";
  elements.tagsInput.value = "";
  elements.ingredientsInput.value = "";
  elements.stepsInput.value = "";
  elements.publishedInput.checked = true;
  elements.premiumInput.checked = true;
}
