const config = window.WORLD_RECIPES_ADMIN_CONFIG || {};
const state = {
  accessToken: "",
  user: null
};

const elements = {
  setupPanel: document.querySelector("#setupPanel"),
  loginPanel: document.querySelector("#loginPanel"),
  recipePanel: document.querySelector("#recipePanel"),
  managePanel: document.querySelector("#managePanel"),
  logoutButton: document.querySelector("#logoutButton"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginButton: document.querySelector("#loginButton"),
  loginStatus: document.querySelector("#loginStatus"),
  sessionText: document.querySelector("#sessionText"),
  titleInput: document.querySelector("#titleInput"),
  countryInput: document.querySelector("#countryInput"),
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
  saveButton: document.querySelector("#saveButton"),
  refreshButton: document.querySelector("#refreshButton"),
  recipeList: document.querySelector("#recipeList"),
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
elements.refreshButton.addEventListener("click", loadRecipeList);

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
    state.user = response.user;
    elements.sessionText.textContent = `Logged in as ${state.user.email}`;
    elements.loginPanel.classList.add("hidden");
    elements.recipePanel.classList.remove("hidden");
    elements.managePanel.classList.remove("hidden");
    elements.logoutButton.classList.remove("hidden");
    await loadRecipeList();
  } catch (error) {
    setStatus(elements.loginStatus, error.message, "error");
  } finally {
    elements.loginButton.disabled = false;
  }
}

function handleLogout() {
  state.accessToken = "";
  state.user = null;
  elements.passwordInput.value = "";
  elements.recipePanel.classList.add("hidden");
  elements.managePanel.classList.add("hidden");
  elements.logoutButton.classList.add("hidden");
  elements.loginPanel.classList.remove("hidden");
  elements.recipeList.innerHTML = "";
}

async function handleSaveRecipe() {
  setStatus(elements.recipeStatus, "");
  elements.saveButton.disabled = true;

  try {
    const ingredients = getLines(elements.ingredientsInput.value);
    const steps = getLines(elements.stepsInput.value);

    if (!elements.titleInput.value.trim() || !elements.countryInput.value.trim()) {
      throw new Error("Recipe title and country are required.");
    }

    if (!ingredients.length || !steps.length) {
      throw new Error("Add at least one ingredient and one cooking step.");
    }

    setStatus(elements.recipeStatus, "Uploading recipe...", "");
    const country = await findOrCreateCountry(elements.countryInput.value.trim());
    const imageUrl = await getRecipeImageUrl();
    const recipe = await createRecipe(country.id, imageUrl);
    await createRecipeLines("recipe_ingredients", recipe.id, ingredients);
    await createRecipeLines("recipe_steps", recipe.id, steps);

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
      "countries(name)"
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
            <p>${escapeHtml(recipe.countries?.name || "Unknown")} - ${
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

async function deleteRecipe(recipeId) {
  await request(`/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}`, {
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

async function createRecipe(countryId, imageUrl) {
  const tags = elements.tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const created = await request("/rest/v1/recipes", {
    method: "POST",
    authed: true,
    prefer: "return=representation",
    body: {
      country_id: countryId,
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

async function createRecipeLines(tableName, recipeId, lines) {
  await request(`/rest/v1/${tableName}`, {
    method: "POST",
    authed: true,
    body: lines.map((line, index) => ({
      recipe_id: recipeId,
      position: index + 1,
      body: line
    }))
  });
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

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.classList.remove("success", "error");

  if (type) {
    element.classList.add(type);
  }
}

function clearRecipeForm() {
  elements.titleInput.value = "";
  elements.countryInput.value = "";
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
