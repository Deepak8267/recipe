const config = window.WORLD_RECIPES_ADMIN_CONFIG || {};
const state = {
  accessToken: "",
  user: null
};

const elements = {
  setupPanel: document.querySelector("#setupPanel"),
  loginPanel: document.querySelector("#loginPanel"),
  recipePanel: document.querySelector("#recipePanel"),
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
  imageInput: document.querySelector("#imageInput"),
  tagsInput: document.querySelector("#tagsInput"),
  ingredientsInput: document.querySelector("#ingredientsInput"),
  stepsInput: document.querySelector("#stepsInput"),
  publishedInput: document.querySelector("#publishedInput"),
  saveButton: document.querySelector("#saveButton"),
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
    elements.logoutButton.classList.remove("hidden");
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
  elements.logoutButton.classList.add("hidden");
  elements.loginPanel.classList.remove("hidden");
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

    const country = await findOrCreateCountry(elements.countryInput.value.trim());
    const recipe = await createRecipe(country.id);
    await createRecipeLines("recipe_ingredients", recipe.id, ingredients);
    await createRecipeLines("recipe_steps", recipe.id, steps);

    clearRecipeForm();
    setStatus(elements.recipeStatus, "Recipe saved successfully.", "success");
  } catch (error) {
    setStatus(elements.recipeStatus, error.message, "error");
  } finally {
    elements.saveButton.disabled = false;
  }
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

async function createRecipe(countryId) {
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
      image_url: elements.imageInput.value.trim(),
      tags,
      is_published: elements.publishedInput.checked
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
  elements.imageInput.value = "";
  elements.tagsInput.value = "";
  elements.ingredientsInput.value = "";
  elements.stepsInput.value = "";
  elements.publishedInput.checked = true;
}
