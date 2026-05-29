import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { signIn, signUp, updateProfile } from "./src/services/authService";
import {
  getFavoriteIds,
  removeFavorite,
  saveFavorite
} from "./src/services/favoriteService";
import { getRecipes } from "./src/services/recipeService";
import { getRecipeReviews, saveRecipeReview } from "./src/services/reviewService";

const screenHeight = Dimensions.get("window").height;
const feedCardHeight = Math.max(620, screenHeight - 132);
const onboardingFallbackImage =
  "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=80";
const onboardingStorageKey = "world-recipes-onboarding-complete";
const shoppingListStorageKey = "world-recipes-shopping-list";
const collectionsStorageKey = "world-recipes-collections";

export default function App() {
  const [recipes, setRecipes] = useState([]);
  const [recipeError, setRecipeError] = useState(null);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [session, setSession] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [favoriteError, setFavoriteError] = useState(null);
  const [currentView, setCurrentView] = useState("home");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [cookingRecipe, setCookingRecipe] = useState(null);
  const [entryStep, setEntryStep] = useState("loading");
  const [shoppingItems, setShoppingItems] = useState([]);
  const [collections, setCollections] = useState([]);
  const [favoritesMode, setFavoritesMode] = useState("recipes");

  useEffect(() => {
    loadRecipes();
    loadEntryStep();
    loadShoppingList();
    loadCollections();
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!session) {
      setFavoriteIds([]);
      return undefined;
    }

    getFavoriteIds(session)
      .then((ids) => {
        if (mounted) {
          setFavoriteIds(ids);
          setFavoriteError(null);
        }
      })
      .catch((error) => {
        if (mounted) {
          setFavoriteError(error.message);
        }
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  async function loadRecipes() {
    setIsLoadingRecipes(true);
    setRecipeError(null);

    try {
      const result = await getRecipes();
      setRecipes(result.recipes);
      setRecipeError(result.error ?? null);
    } catch (error) {
      setRecipeError(error.message);
    } finally {
      setIsLoadingRecipes(false);
    }
  }

  async function loadEntryStep() {
    try {
      const hasCompletedOnboarding = await AsyncStorage.getItem(onboardingStorageKey);
      setEntryStep(hasCompletedOnboarding === "true" ? "done" : "splash");
    } catch {
      setEntryStep("splash");
    }
  }

  async function completeEntryFlow() {
    try {
      await AsyncStorage.setItem(onboardingStorageKey, "true");
    } catch {
      // Continue even if storage is unavailable.
    }

    setEntryStep("done");
    setCurrentView(session ? "home" : "profile");
  }

  async function loadShoppingList() {
    try {
      const storedItems = await AsyncStorage.getItem(shoppingListStorageKey);
      setShoppingItems(storedItems ? JSON.parse(storedItems) : []);
    } catch {
      setShoppingItems([]);
    }
  }

  async function saveShoppingItems(items) {
    setShoppingItems(items);

    try {
      await AsyncStorage.setItem(shoppingListStorageKey, JSON.stringify(items));
    } catch {
      // Shopping list still works in memory if storage is unavailable.
    }
  }

  async function loadCollections() {
    try {
      const storedCollections = await AsyncStorage.getItem(collectionsStorageKey);
      setCollections(storedCollections ? JSON.parse(storedCollections) : []);
    } catch {
      setCollections([]);
    }
  }

  async function saveCollections(nextCollections) {
    setCollections(nextCollections);

    try {
      await AsyncStorage.setItem(collectionsStorageKey, JSON.stringify(nextCollections));
    } catch {
      // Collections still work in memory if storage is unavailable.
    }
  }

  const countries = useMemo(
    () => ["All", ...new Set(recipes.map((recipe) => recipe.country))],
    [recipes]
  );

  const countryStats = useMemo(
    () =>
      countries.map((country) => ({
        country,
        count:
          country === "All"
            ? recipes.length
            : recipes.filter((recipe) => recipe.country === country).length
      })),
    [countries, recipes]
  );

  const categoryStats = useMemo(() => {
    const categoryNames = [
      "All",
      ...new Set(
        recipes.map((recipe) => recipe.category || inferRecipeCategory(recipe)).filter(Boolean)
      )
    ];

    return categoryNames.map((category) => ({
      category,
      count:
        category === "All"
          ? recipes.length
          : recipes.filter(
              (recipe) => (recipe.category || inferRecipeCategory(recipe)) === category
            ).length
    }));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return recipes.filter((recipe) => {
      const matchesCountry =
        selectedCountry === "All" || recipe.country === selectedCountry;
      const recipeCategory = recipe.category || inferRecipeCategory(recipe);
      const matchesCategory =
        selectedCategory === "All" || recipeCategory === selectedCategory;
      const searchableText = [
        recipe.title,
        recipe.country,
        recipeCategory,
        recipe.region,
        recipe.difficulty,
        ...recipe.tags,
        ...recipe.ingredients.map(formatIngredientText)
      ]
        .join(" ")
        .toLowerCase();

      return matchesCountry && matchesCategory && searchableText.includes(normalizedQuery);
    });
  }, [query, recipes, selectedCategory, selectedCountry]);

  const savedRecipes = useMemo(
    () => recipes.filter((recipe) => favoriteIds.includes(recipe.id)),
    [favoriteIds, recipes]
  );

  const freeRecipes = useMemo(
    () => recipes.filter((recipe) => !recipe.isPremium),
    [recipes]
  );

  const premiumRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.isPremium),
    [recipes]
  );

  function changeView(view) {
    setActiveRecipe(null);
    setCookingRecipe(null);
    if (view === "favorites") {
      setFavoritesMode("recipes");
    }
    setCurrentView(view);
  }

  function openSubscription() {
    setActiveRecipe(null);
    setCookingRecipe(null);
    setCurrentView(session ? "subscription" : "profile");
  }

  function openRecipe(recipe) {
    if (recipe.isPremium && !hasSubscription) {
      openSubscription();
      return;
    }

    setActiveRecipe(recipe);
  }

  function handleLogout() {
    setSession(null);
    setFavoriteIds([]);
    setCurrentView("home");
  }

  async function toggleFavorite(recipeId) {
    if (!session) {
      setCurrentView("profile");
      return;
    }

    const isSaved = favoriteIds.includes(recipeId);
    const nextFavoriteIds = isSaved
      ? favoriteIds.filter((id) => id !== recipeId)
      : [...favoriteIds, recipeId];

    setFavoriteIds(nextFavoriteIds);
    setFavoriteError(null);

    try {
      if (isSaved) {
        await removeFavorite(session, recipeId);
      } else {
        await saveFavorite(session, recipeId);
      }
    } catch (error) {
      setFavoriteIds(favoriteIds);
      setFavoriteError(error.message);
    }
  }

  function addIngredientToShoppingList(recipe, ingredient) {
    const text = formatIngredientText(ingredient);
    const existingItem = shoppingItems.find(
      (item) => item.name.toLowerCase() === text.toLowerCase()
    );

    if (existingItem) {
      saveShoppingItems(
        shoppingItems.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                checked: false,
                recipes: [...new Set([...item.recipes, recipe.title])]
              }
            : item
        )
      );
      return;
    }

    saveShoppingItems([
      ...shoppingItems,
      {
        checked: false,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: text,
        recipes: [recipe.title]
      }
    ]);
  }

  function toggleShoppingItem(itemId) {
    saveShoppingItems(
      shoppingItems.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  }

  function deleteShoppingItem(itemId) {
    saveShoppingItems(shoppingItems.filter((item) => item.id !== itemId));
  }

  function clearCheckedShoppingItems() {
    saveShoppingItems(shoppingItems.filter((item) => !item.checked));
  }

  function createCollection(name, initialRecipeId = "") {
    const cleanName = name.trim();

    if (!cleanName) {
      return null;
    }

    const existingCollection = collections.find(
      (collection) => collection.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existingCollection) {
      if (initialRecipeId && !existingCollection.recipeIds.includes(initialRecipeId)) {
        const updatedCollection = {
          ...existingCollection,
          recipeIds: [...existingCollection.recipeIds, initialRecipeId]
        };
        saveCollections(
          collections.map((collection) =>
            collection.id === existingCollection.id ? updatedCollection : collection
          )
        );
        return updatedCollection;
      }

      return existingCollection;
    }

    const collection = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: cleanName,
      recipeIds: initialRecipeId ? [initialRecipeId] : []
    };
    saveCollections([...collections, collection]);
    return collection;
  }

  function addRecipeToCollection(collectionId, recipeId) {
    saveCollections(
      collections.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              recipeIds: [...new Set([...collection.recipeIds, recipeId])]
            }
          : collection
      )
    );
  }

  function removeRecipeFromCollection(collectionId, recipeId) {
    saveCollections(
      collections.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              recipeIds: collection.recipeIds.filter((id) => id !== recipeId)
            }
          : collection
      )
    );
  }

  function deleteCollection(collectionId) {
    saveCollections(collections.filter((collection) => collection.id !== collectionId));
  }

  function openCollections() {
    setFavoritesMode("collections");
    setCurrentView("favorites");
  }

  if (entryStep === "loading") {
    return (
      <SafeAreaView style={styles.darkSafeArea}>
        <StatusBar style="light" />
        <View style={styles.feedState}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.feedStateTitle}>World Recipes</Text>
          <Text style={styles.feedStateText}>Preparing your kitchen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (entryStep === "splash") {
    return (
      <SplashScreen
        image={recipes[0]?.image ?? onboardingFallbackImage}
        onGetStarted={() => setEntryStep("onboarding")}
      />
    );
  }

  if (entryStep === "onboarding") {
    return (
      <OnboardingScreen
        images={[
          recipes[0]?.image ?? onboardingFallbackImage,
          recipes[1]?.image ?? onboardingFallbackImage,
          recipes[2]?.image ?? recipes[0]?.image ?? onboardingFallbackImage
        ]}
        onComplete={completeEntryFlow}
        onSkip={completeEntryFlow}
      />
    );
  }

  if (cookingRecipe) {
    return (
      <CookingModeScreen
        recipe={cookingRecipe}
        onBack={() => setCookingRecipe(null)}
      />
    );
  }

  if (activeRecipe) {
    return (
      <RecipeDetailScreen
        favoriteError={favoriteError}
        recipe={activeRecipe}
        saved={favoriteIds.includes(activeRecipe.id)}
        session={session}
        signedIn={Boolean(session)}
        collections={collections}
        onAddIngredient={addIngredientToShoppingList}
        onAddRecipeToCollection={addRecipeToCollection}
        onBack={() => setActiveRecipe(null)}
        onCreateCollection={createCollection}
        onStartCooking={() => setCookingRecipe(activeRecipe)}
        onToggleFavorite={() => toggleFavorite(activeRecipe.id)}
      />
    );
  }

  if (currentView === "subscription") {
    return (
      <SubscriptionScreen
        hasSubscription={hasSubscription}
        onBack={() => setCurrentView("home")}
        onPreviewChange={setHasSubscription}
      />
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        currentView === "home" ? styles.darkSafeArea : styles.lightSafeArea
      ]}
    >
      <StatusBar style={currentView === "home" ? "light" : "dark"} />
      {currentView === "home" ? (
        <HomeFeed
          favoriteError={favoriteError}
          favoriteIds={favoriteIds}
          hasSubscription={hasSubscription}
          isLoading={isLoadingRecipes}
          recipeError={recipeError}
          recipes={filteredRecipes.length ? filteredRecipes : recipes}
          session={session}
          query={query}
          totalRecipes={recipes.length}
          onOpenExplore={() => setCurrentView("explore")}
          onOpenRecipe={openRecipe}
          onOpenSubscription={openSubscription}
          onOpenProfile={() => setCurrentView("profile")}
          onQueryChange={setQuery}
          onRetry={loadRecipes}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}

      {currentView === "explore" ? (
        <ExploreScreen
          countries={countryStats}
          categories={categoryStats}
          freeRecipes={freeRecipes}
          premiumRecipes={premiumRecipes}
          query={query}
          recipes={filteredRecipes}
          selectedCategory={selectedCategory}
          selectedCountry={selectedCountry}
          onCategoryChange={setSelectedCategory}
          onCountryChange={setSelectedCountry}
          onOpenRecipe={openRecipe}
          onQueryChange={setQuery}
        />
      ) : null}

      {currentView === "favorites" ? (
        <FavoritesScreen
          allRecipes={recipes}
          collections={collections}
          mode={favoritesMode}
          recipes={savedRecipes}
          onCreateCollection={createCollection}
          onDeleteCollection={deleteCollection}
          onModeChange={setFavoritesMode}
          onOpenRecipe={openRecipe}
          onRemoveFromCollection={removeRecipeFromCollection}
        />
      ) : null}

      {currentView === "shopping" ? (
        <ShoppingListScreen
          items={shoppingItems}
          onClearChecked={clearCheckedShoppingItems}
          onDeleteItem={deleteShoppingItem}
          onToggleItem={toggleShoppingItem}
        />
      ) : null}

      {currentView === "profile" ? (
        <ScrollView style={styles.lightScreen} showsVerticalScrollIndicator={false}>
          {session ? (
            <ProfileScreen
              favoriteError={favoriteError}
              hasSubscription={hasSubscription}
              session={session}
              savedRecipes={savedRecipes}
              collectionsCount={collections.length}
              shoppingCount={shoppingItems.length}
              onOpenSubscription={openSubscription}
              onLogout={handleLogout}
              onOpenCollections={openCollections}
              onOpenShoppingList={() => setCurrentView("shopping")}
              onSessionChange={setSession}
            />
          ) : (
            <AuthScreen
              shoppingCount={shoppingItems.length}
              onOpenShoppingList={() => setCurrentView("shopping")}
              onSessionChange={setSession}
            />
          )}
        </ScrollView>
      ) : null}

      <BottomNav
        currentView={currentView}
        signedIn={Boolean(session)}
        onChange={changeView}
      />
    </SafeAreaView>
  );
}

function SplashScreen({ image, onGetStarted }) {
  return (
    <SafeAreaView style={styles.darkSafeArea}>
      <StatusBar style="light" />
      <ImageBackground source={{ uri: image }} style={styles.entryScreen}>
        <View style={styles.entryOverlay} />
        <View style={styles.splashContent}>
          <View style={styles.chefMark}>
            <Text style={styles.chefMarkText}>WR</Text>
          </View>
          <Text style={styles.splashTitle}>
            Cook.{"\n"}Discover.{"\n"}
            <Text style={styles.accentText}>Enjoy.</Text>
          </Text>
          <Text style={styles.splashSubtitle}>
            Delicious recipes, curated for your next meal.
          </Text>
        </View>
        <View style={styles.entryFooter}>
          <Pressable onPress={onGetStarted} style={styles.entryButton}>
            <Text style={styles.entryButtonText}>Get Started</Text>
          </Pressable>
          <Text style={styles.entryHint}>Already have an account? Login after setup</Text>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

function inferRecipeCategory(recipe) {
  const knownCategories = ["Breakfast", "Lunch", "Dinner", "Desserts", "Healthy", "Vegetarian"];
  return knownCategories.find((category) => recipe.tags?.includes(category)) ?? "Dinner";
}

function formatIngredientText(ingredient) {
  if (typeof ingredient === "string") {
    return ingredient;
  }

  return [ingredient.quantity, ingredient.unit, ingredient.name || ingredient.body]
    .filter(Boolean)
    .join(" ");
}

function getAverageRating(reviews) {
  if (!reviews.length) {
    return 0;
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return total / reviews.length;
}

function OnboardingScreen({ images, onComplete, onSkip }) {
  const [index, setIndex] = useState(0);
  const slides = [
    {
      title: "Discover amazing recipes",
      body: "Explore thousands of recipes from around the world."
    },
    {
      title: "Cook with confidence",
      body: "Step by step instructions make cooking feel easy."
    },
    {
      title: "Save and enjoy favorites",
      body: "Keep your best dishes close whenever you want."
    }
  ];
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  function goNext() {
    if (isLast) {
      onComplete();
      return;
    }

    setIndex((value) => value + 1);
  }

  return (
    <SafeAreaView style={styles.darkSafeArea}>
      <StatusBar style="light" />
      <ImageBackground source={{ uri: images[index] }} style={styles.entryScreen}>
        <View style={styles.entryOverlay} />
        <Pressable onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <View style={styles.onboardingCopy}>
          <Text style={styles.onboardingTitle}>
            {highlightOnboardingTitle(slide.title)}
          </Text>
          <Text style={styles.onboardingBody}>{slide.body}</Text>
        </View>
        <View style={styles.entryFooter}>
          <View style={styles.onboardingDots}>
            {slides.map((item, dotIndex) => (
              <View
                key={item.title}
                style={[
                  styles.onboardingDot,
                  dotIndex === index && styles.onboardingDotActive
                ]}
              />
            ))}
          </View>
          <Pressable onPress={goNext} style={styles.entryButton}>
            <Text style={styles.entryButtonText}>
              {isLast ? "Get Started" : "Next"}
            </Text>
          </Pressable>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

function highlightOnboardingTitle(title) {
  const wordsToHighlight = ["recipes", "confidence", "favorites"];
  const match = wordsToHighlight.find((word) => title.includes(word));

  if (!match) {
    return title;
  }

  const [before, after] = title.split(match);

  return (
    <>
      {before}
      <Text style={styles.accentText}>{match}</Text>
      {after}
    </>
  );
}

function HomeFeed({
  favoriteError,
  favoriteIds,
  hasSubscription,
  isLoading,
  recipeError,
  recipes,
  session,
  query,
  totalRecipes,
  onOpenExplore,
  onOpenRecipe,
  onOpenSubscription,
  onOpenProfile,
  onQueryChange,
  onRetry,
  onToggleFavorite
}) {
  if (isLoading) {
    return (
      <View style={styles.feedState}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.feedStateTitle}>Preparing your feed</Text>
        <Text style={styles.feedStateText}>Fresh recipes are loading.</Text>
      </View>
    );
  }

  if (recipeError && !recipes.length) {
    return (
      <View style={styles.feedState}>
        <Text style={styles.feedStateTitle}>Could not load recipes</Text>
        <Text style={styles.feedStateText}>{recipeError}</Text>
        <Pressable style={styles.feedCtaButton} onPress={onRetry}>
          <Text style={styles.feedCtaText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!recipes.length) {
    return (
      <View style={styles.feedState}>
        <Text style={styles.feedStateTitle}>No recipes yet</Text>
        <Text style={styles.feedStateText}>Published recipes will appear here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recipes}
      keyExtractor={(item) => item.id}
      pagingEnabled
      snapToAlignment="start"
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.feedList}
      renderItem={({ item, index }) => (
        <FeedRecipeCard
          favoriteError={favoriteError}
          index={index}
          isSaved={favoriteIds.includes(item.id)}
          locked={item.isPremium && !hasSubscription}
          recipe={item}
          recipeCount={recipes.length}
          query={query}
          signedIn={Boolean(session)}
          totalRecipes={totalRecipes}
          onOpenExplore={onOpenExplore}
          onOpenRecipe={onOpenRecipe}
          onOpenSubscription={onOpenSubscription}
          onOpenProfile={onOpenProfile}
          onQueryChange={onQueryChange}
          onToggleFavorite={onToggleFavorite}
        />
      )}
    />
  );
}

function FeedRecipeCard({
  favoriteError,
  index,
  isSaved,
  locked,
  recipe,
  recipeCount,
  query,
  signedIn,
  totalRecipes,
  onOpenExplore,
  onOpenRecipe,
  onOpenSubscription,
  onOpenProfile,
  onQueryChange,
  onToggleFavorite
}) {
  return (
    <View style={styles.feedCardShell}>
      <ImageBackground
        source={{ uri: recipe.image }}
        style={styles.feedCard}
        imageStyle={styles.feedCardImage}
      >
        <View style={styles.feedShade} />
        <View style={styles.feedTopBar}>
          <View>
            <Text style={styles.feedGreeting}>
              {signedIn ? "Good evening, chef" : "Good evening"}
            </Text>
            <Text style={styles.feedBrand}>World Recipes</Text>
          </View>
          <View style={styles.feedTopActions}>
            <Pressable onPress={onOpenExplore} style={styles.notificationBubble}>
              <Text style={styles.notificationText}>Bell</Text>
            </Pressable>
            <Pressable onPress={onOpenProfile} style={styles.profileBubble}>
              <Text style={styles.profileBubbleText}>WR</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={onOpenExplore}
          placeholder="Search recipes, ingredients..."
          placeholderTextColor="#D8D0CA"
          returnKeyType="search"
          style={styles.feedSearchInput}
        />

        <View style={styles.feedBody}>
          <View style={styles.feedBadgeRow}>
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingBadgeText}>
                {locked ? "Premium" : index === 0 ? "Trending" : recipe.country}
              </Text>
            </View>
            <Pressable
              onPress={() => (locked ? onOpenSubscription() : onToggleFavorite(recipe.id))}
              style={styles.roundAction}
            >
              <Text style={styles.roundActionText}>
                {locked ? "Lock" : isSaved ? "Saved" : "Save"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.feedProgressText}>
            {index + 1} / {recipeCount} in feed - {totalRecipes} total recipes
          </Text>

          <Text style={styles.feedTitle}>{recipe.title}</Text>
          <View style={styles.feedMetaRow}>
            <Text style={styles.feedMeta}>{recipe.timeMinutes} min</Text>
            <Text style={styles.feedMeta}>{recipe.difficulty}</Text>
            <Text style={styles.feedMeta}>{recipe.country}</Text>
          </View>
          <Text style={styles.feedDescription}>
            {locked
              ? "Unlock this premium recipe with your subscription."
              : recipe.region || "Discover a rich dish with premium food storytelling."}
          </Text>
          {favoriteError ? <Text style={styles.feedError}>{favoriteError}</Text> : null}

          <Pressable
            onPress={() => (locked ? onOpenSubscription() : onOpenRecipe(recipe))}
            style={styles.feedCtaButton}
          >
            <Text style={styles.feedCtaText}>
              {locked ? "View Premium" : "View Recipe"}
            </Text>
          </Pressable>
          <View style={styles.feedDots}>
            {[0, 1, 2, 3].map((dot) => (
              <View
                key={dot}
                style={[styles.feedDot, dot === index % 4 && styles.feedDotActive]}
              />
            ))}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

function ExploreScreen({
  categories,
  countries,
  freeRecipes,
  premiumRecipes,
  query,
  recipes,
  selectedCategory,
  selectedCountry,
  onCategoryChange,
  onCountryChange,
  onOpenRecipe,
  onQueryChange
}) {
  return (
    <ScrollView style={styles.lightScreen} showsVerticalScrollIndicator={false}>
      <View style={styles.lightHeader}>
        <Text style={styles.lightTitle}>Explore</Text>
        <Text style={styles.lightIcon}>Search</Text>
      </View>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search recipes, ingredients..."
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
      />

      <SectionHeader title="Categories" action="Filters" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroller}
      >
        {categories.map(({ category, count }) => {
          const selected = selectedCategory === category;
          return (
            <Pressable
              key={category}
              onPress={() => onCategoryChange(category)}
              style={[styles.categoryChip, selected && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryIcon, selected && styles.categoryIconActive]}>
                {category.slice(0, 1)}
              </Text>
              <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>
                {category}
              </Text>
              <Text style={[styles.categoryCount, selected && styles.categoryTextActive]}>
                {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeader title="Popular Countries" action={`${countries.length} total`} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.countryScroller}
      >
        {countries.map(({ country, count }) => {
          const selected = selectedCountry === country;
          return (
            <Pressable
              key={country}
              onPress={() => onCountryChange(country)}
              style={[styles.countryCuisine, selected && styles.countryCuisineActive]}
            >
              <Text
                style={[
                  styles.countryCuisineTitle,
                  selected && styles.countryCuisineTitleActive
                ]}
              >
                {country}
              </Text>
              <Text
                style={[
                  styles.countryCuisineCount,
                  selected && styles.countryCuisineCountActive
                ]}
              >
                {count} recipes
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeader title="Trending Recipes" action="See all" />
      {recipes.map((recipe) => (
        <CompactRecipeRow
          key={recipe.id}
          recipe={recipe}
          onPress={() => onOpenRecipe(recipe)}
        />
      ))}

      <SectionHeader title="Free To Start" action={`${freeRecipes.length} recipes`} />
      <HorizontalRecipeStrip recipes={freeRecipes} onOpenRecipe={onOpenRecipe} />

      <SectionHeader title="Premium Picks" action={`${premiumRecipes.length} recipes`} />
      <HorizontalRecipeStrip recipes={premiumRecipes} onOpenRecipe={onOpenRecipe} />
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function HorizontalRecipeStrip({ recipes, onOpenRecipe }) {
  if (!recipes.length) {
    return <Text style={styles.emptyText}>No recipes in this section yet.</Text>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.recipeStrip}
    >
      {recipes.slice(0, 8).map((recipe) => (
        <Pressable
          key={recipe.id}
          onPress={() => onOpenRecipe(recipe)}
          style={styles.stripCard}
        >
          <Image source={{ uri: recipe.image }} style={styles.stripImage} />
          <Text style={styles.stripTitle}>{recipe.title}</Text>
          <Text style={styles.stripMeta}>{recipe.country}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function FavoritesScreen({
  allRecipes,
  collections,
  mode,
  recipes,
  onCreateCollection,
  onDeleteCollection,
  onModeChange,
  onOpenRecipe,
  onRemoveFromCollection
}) {
  const [collectionName, setCollectionName] = useState("");

  function handleCreateCollection() {
    const collection = onCreateCollection(collectionName);
    if (collection) {
      setCollectionName("");
      onModeChange("collections");
    }
  }

  return (
    <ScrollView style={styles.lightScreen} showsVerticalScrollIndicator={false}>
      <View style={styles.lightHeader}>
        <Text style={styles.lightTitle}>Favorites</Text>
        <Text style={styles.lightIcon}>Saved</Text>
      </View>
      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => onModeChange("recipes")}
          style={[styles.segmentPill, mode === "recipes" && styles.segmentPillActive]}
        >
          <Text style={mode === "recipes" ? styles.segmentTextActive : styles.segmentText}>
            All Recipes
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onModeChange("collections")}
          style={[styles.segmentPill, mode === "collections" && styles.segmentPillActive]}
        >
          <Text
            style={mode === "collections" ? styles.segmentTextActive : styles.segmentText}
          >
            Collections
          </Text>
        </Pressable>
        <View style={styles.segmentPill}>
          <Text style={styles.segmentText}>Videos</Text>
        </View>
      </View>

      {mode === "recipes" ? (
        recipes.length ? (
          recipes.map((recipe) => (
            <CompactRecipeRow
              key={recipe.id}
              recipe={recipe}
              saved
              onPress={() => onOpenRecipe(recipe)}
            />
          ))
        ) : (
          <View style={styles.stateBox}>
            <Text style={styles.emptyTitle}>No saved recipes</Text>
            <Text style={styles.emptyText}>
              Save dishes from the home feed and they will appear here.
            </Text>
          </View>
        )
      ) : null}

      {mode === "collections" ? (
        <View>
          <View style={styles.collectionCreatePanel}>
            <Text style={styles.sectionTitle}>Create Collection</Text>
            <TextInput
              value={collectionName}
              onChangeText={setCollectionName}
              placeholder="Quick Dinners"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
            />
            <Pressable onPress={handleCreateCollection} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Create collection</Text>
            </Pressable>
          </View>
          {collections.length ? (
            collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                allRecipes={allRecipes}
                collection={collection}
                onDeleteCollection={onDeleteCollection}
                onOpenRecipe={onOpenRecipe}
                onRemoveFromCollection={onRemoveFromCollection}
              />
            ))
          ) : (
            <View style={styles.stateBox}>
              <Text style={styles.emptyTitle}>No collections yet</Text>
              <Text style={styles.emptyText}>
                Create collections for quick dinners, desserts, or country favorites.
              </Text>
            </View>
          )}
        </View>
      ) : null}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function CollectionCard({
  allRecipes,
  collection,
  onDeleteCollection,
  onOpenRecipe,
  onRemoveFromCollection
}) {
  const collectionRecipes = collection.recipeIds
    .map((recipeId) => allRecipes.find((recipe) => recipe.id === recipeId))
    .filter(Boolean);

  return (
    <View style={styles.collectionCard}>
      <View style={styles.collectionHeader}>
        <View>
          <Text style={styles.collectionTitle}>{collection.name}</Text>
          <Text style={styles.collectionMeta}>
            {collectionRecipes.length} recipe{collectionRecipes.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Pressable
          onPress={() => onDeleteCollection(collection.id)}
          style={styles.deleteItemButton}
        >
          <Text style={styles.deleteItemText}>Delete</Text>
        </Pressable>
      </View>
      {collectionRecipes.length ? (
        collectionRecipes.map((recipe) => (
          <View key={recipe.id} style={styles.collectionRecipeRow}>
            <Pressable
              onPress={() => onOpenRecipe(recipe)}
              style={styles.collectionRecipeButton}
            >
              <Image source={{ uri: recipe.image }} style={styles.collectionRecipeImage} />
              <View style={styles.collectionRecipeCopy}>
                <Text style={styles.compactTitle}>{recipe.title}</Text>
                <Text style={styles.compactMeta}>{recipe.country}</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => onRemoveFromCollection(collection.id, recipe.id)}
              style={styles.deleteItemButton}
            >
              <Text style={styles.deleteItemText}>Remove</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Add recipes from the recipe detail page.</Text>
      )}
    </View>
  );
}

function ShoppingListScreen({ items, onClearChecked, onDeleteItem, onToggleItem }) {
  const checkedCount = items.filter((item) => item.checked).length;

  return (
    <ScrollView style={styles.lightScreen} showsVerticalScrollIndicator={false}>
      <View style={styles.lightHeader}>
        <View>
          <Text style={styles.lightTitle}>Shopping List</Text>
          <Text style={styles.listSubtitle}>
            {items.length} items - {checkedCount} checked
          </Text>
        </View>
        <Pressable onPress={onClearChecked} style={styles.clearListButton}>
          <Text style={styles.clearListText}>Clear checked</Text>
        </Pressable>
      </View>

      {items.length ? (
        items.map((item) => (
          <View key={item.id} style={styles.shoppingItemRow}>
            <Pressable
              onPress={() => onToggleItem(item.id)}
              style={[styles.shoppingCheck, item.checked && styles.shoppingCheckActive]}
            >
              <Text
                style={[
                  styles.shoppingCheckText,
                  item.checked && styles.shoppingCheckTextActive
                ]}
              >
                {item.checked ? "Done" : ""}
              </Text>
            </Pressable>
            <View style={styles.shoppingCopy}>
              <Text
                style={[
                  styles.shoppingTitle,
                  item.checked && styles.shoppingTitleChecked
                ]}
              >
                {item.name}
              </Text>
              <Text style={styles.shoppingMeta}>
                From {item.recipes.join(", ")}
              </Text>
            </View>
            <Pressable onPress={() => onDeleteItem(item.id)} style={styles.deleteItemButton}>
              <Text style={styles.deleteItemText}>Remove</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <View style={styles.stateBox}>
          <Text style={styles.emptyTitle}>Your list is empty</Text>
          <Text style={styles.emptyText}>
            Open a recipe and tap + beside ingredients to build your shopping list.
          </Text>
        </View>
      )}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function RecipeDetailScreen({
  collections,
  favoriteError,
  recipe,
  saved,
  session,
  signedIn,
  onAddIngredient,
  onAddRecipeToCollection,
  onBack,
  onCreateCollection,
  onStartCooking,
  onToggleFavorite
}) {
  const [tab, setTab] = useState("Ingredients");
  const [reviews, setReviews] = useState([]);
  const [reviewError, setReviewError] = useState("");
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [isCollectionSheetOpen, setIsCollectionSheetOpen] = useState(false);
  const tabs = ["Ingredients", "Steps", "Nutrition", "Reviews"];
  const averageRating = getAverageRating(reviews);
  const savedCollectionCount = collections.filter((collection) =>
    collection.recipeIds.includes(recipe.id)
  ).length;

  useEffect(() => {
    let mounted = true;

    setIsLoadingReviews(true);
    setReviewError("");

    getRecipeReviews(recipe.id)
      .then((nextReviews) => {
        if (mounted) {
          setReviews(nextReviews);
        }
      })
      .catch((error) => {
        if (mounted) {
          setReviewError(error.message);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingReviews(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [recipe.id]);

  async function handleSaveReview({ rating, comment }) {
    const savedReview = await saveRecipeReview({
      comment,
      rating,
      recipeId: recipe.id,
      session
    });

    setReviews((currentReviews) => {
      const withoutUserReview = currentReviews.filter(
        (review) => review.userId !== savedReview.userId
      );

      return [savedReview, ...withoutUserReview];
    });
  }

  return (
    <SafeAreaView style={styles.lightSafeArea}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.detailHero}>
          <Image source={{ uri: recipe.image }} style={styles.detailImage} />
          <Pressable style={styles.detailBackButton} onPress={onBack}>
            <Text style={styles.detailBackText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={onToggleFavorite}
            style={[styles.detailSaveButton, saved && styles.detailSaveButtonActive]}
          >
            <Text
              style={[
                styles.detailSaveText,
                saved && styles.detailSaveTextActive
              ]}
            >
              {saved ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.detailContent}>
          <View style={styles.detailSheet}>
            <Text style={styles.detailTitle}>{recipe.title}</Text>
            <View style={styles.feedMetaRow}>
              <Text style={styles.detailMeta}>{recipe.timeMinutes} min</Text>
              <Text style={styles.detailMeta}>{recipe.difficulty}</Text>
              <Text style={styles.detailMeta}>{recipe.country}</Text>
            </View>
            <Text style={styles.detailSubtext}>
              {recipe.region || "A premium recipe with step-by-step guidance."}
            </Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>
                {reviews.length ? averageRating.toFixed(1) : "New"}
              </Text>
              <Text style={styles.ratingCopy}>
                {reviews.length
                  ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}`
                  : "Be the first to review"}
              </Text>
            </View>
            {!signedIn ? (
              <Text style={styles.helperText}>Login first to save this recipe.</Text>
            ) : null}
            {favoriteError ? <Text style={styles.errorText}>{favoriteError}</Text> : null}
            <Pressable
              onPress={() => setIsCollectionSheetOpen(true)}
              style={styles.detailCollectionAction}
            >
              <View>
                <Text style={styles.detailCollectionLabel}>Collections</Text>
                <Text style={styles.detailCollectionTitle}>
                  {savedCollectionCount
                    ? `In ${savedCollectionCount} collection${
                        savedCollectionCount === 1 ? "" : "s"
                      }`
                    : "Add to collection"}
                </Text>
              </View>
              <Text style={styles.detailCollectionPlus}>+</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.detailTabs}
          >
            {tabs.map((item) => (
              <Pressable
                key={item}
                onPress={() => setTab(item)}
                style={[styles.detailTab, tab === item && styles.detailTabActive]}
              >
                <Text
                  style={[
                    styles.detailTabText,
                    tab === item && styles.detailTabTextActive
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {tab === "Ingredients" ? (
            <IngredientList recipe={recipe} onAddIngredient={onAddIngredient} />
          ) : null}
          {tab === "Steps" ? (
            <RecipeSection title="Cooking Steps" items={recipe.steps} numbered />
          ) : null}
          {tab === "Nutrition" ? (
            <InfoPanel
              title="Nutrition"
              body="Nutrition facts will be added from the admin panel later. For now, use servings and ingredients as the guide."
            />
          ) : null}
          {tab === "Reviews" ? (
            <ReviewsPanel
              isLoading={isLoadingReviews}
              reviewError={reviewError}
              reviews={reviews}
              session={session}
              onSaveReview={handleSaveReview}
            />
          ) : null}
        </View>
      </ScrollView>
      <Modal
        animationType="slide"
        transparent
        visible={isCollectionSheetOpen}
        onRequestClose={() => setIsCollectionSheetOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsCollectionSheetOpen(false)}
        >
          <Pressable style={styles.collectionSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.collectionSheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>Save recipe</Text>
                <Text style={styles.sheetTitle}>Add to collection</Text>
              </View>
              <Pressable
                onPress={() => setIsCollectionSheetOpen(false)}
                style={styles.sheetCloseButton}
              >
                <Text style={styles.sheetCloseText}>Close</Text>
              </Pressable>
            </View>
            <CollectionPicker
              collections={collections}
              recipe={recipe}
              onAddRecipeToCollection={onAddRecipeToCollection}
              onCreateCollection={onCreateCollection}
            />
          </Pressable>
        </Pressable>
      </Modal>
      <View style={styles.stickyCta}>
        <Pressable onPress={onStartCooking} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Start Cooking</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function IngredientList({ recipe, onAddIngredient }) {
  const [status, setStatus] = useState("");

  function handleAddIngredient(ingredient) {
    onAddIngredient(recipe, ingredient);
    setStatus(`${formatIngredientText(ingredient)} added to shopping list.`);
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Ingredients</Text>
      {status ? <Text style={styles.successText}>{status}</Text> : null}
      {recipe.ingredients.length ? (
        recipe.ingredients.map((ingredient, index) => (
          <View key={`${formatIngredientText(ingredient)}-${index}`} style={styles.ingredientRow}>
            <Image
              source={{ uri: ingredient.image || recipe.image }}
              style={styles.ingredientImage}
            />
            <View style={styles.ingredientCopy}>
              <Text style={styles.ingredientTitle}>
                {typeof ingredient === "string" ? ingredient : ingredient.name}
              </Text>
              <Text style={styles.ingredientMeta}>
                {typeof ingredient === "string"
                  ? "Measure to taste"
                  : [ingredient.quantity, ingredient.unit].filter(Boolean).join(" ") ||
                    ingredient.body ||
                    "Measure to taste"}
              </Text>
            </View>
            <Pressable
              onPress={() => handleAddIngredient(ingredient)}
              style={styles.addIngredientButton}
            >
              <Text style={styles.addButton}>+</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Ingredients will appear here.</Text>
      )}
    </View>
  );
}

function ReviewsPanel({ isLoading, reviewError, reviews, session, onSaveReview }) {
  const userReview = session
    ? reviews.find((review) => review.userId === session.user.id)
    : null;

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Reviews</Text>
      {reviewError ? <Text style={styles.errorText}>{reviewError}</Text> : null}
      {isLoading ? (
        <Text style={styles.emptyText}>Loading reviews...</Text>
      ) : null}
      {session ? (
        <ReviewForm existingReview={userReview} onSaveReview={onSaveReview} />
      ) : (
        <Text style={styles.helperText}>Login to rate and review this recipe.</Text>
      )}
      <View style={styles.reviewList}>
        {reviews.length ? (
          reviews.map((review) => <ReviewRow key={review.id} review={review} />)
        ) : (
          <Text style={styles.emptyText}>No reviews yet.</Text>
        )}
      </View>
    </View>
  );
}

function CollectionPicker({
  collections,
  recipe,
  onAddRecipeToCollection,
  onCreateCollection
}) {
  const [collectionName, setCollectionName] = useState("");
  const [status, setStatus] = useState("");

  function handleCreateAndAdd() {
    const collection = onCreateCollection(collectionName, recipe.id);

    if (!collection) {
      setStatus("Enter a collection name.");
      return;
    }

    setCollectionName("");
    setStatus(`Added to ${collection.name}.`);
  }

  function handleQuickCreateAndAdd(name) {
    const collection = onCreateCollection(name, recipe.id);

    if (!collection) {
      return;
    }

    setStatus(`Added to ${collection.name}.`);
  }

  function handleAdd(collection) {
    onAddRecipeToCollection(collection.id, recipe.id);
    setStatus(`Added to ${collection.name}.`);
  }

  return (
    <View style={styles.detailCollectionBox}>
      {status ? <Text style={styles.successText}>{status}</Text> : null}
      {collections.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.collectionChipRow}
        >
          {collections.map((collection) => {
            const alreadyAdded = collection.recipeIds.includes(recipe.id);
            return (
              <Pressable
                key={collection.id}
                onPress={() => handleAdd(collection)}
                style={[
                  styles.collectionChip,
                  alreadyAdded && styles.collectionChipActive
                ]}
              >
                <Text
                  style={[
                    styles.collectionChipText,
                    alreadyAdded && styles.collectionChipTextActive
                  ]}
                >
                  {alreadyAdded ? `${collection.name} added` : collection.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View>
          <Text style={styles.helperText}>Create your first collection below.</Text>
          <View style={styles.quickCollectionRow}>
            {["Quick Dinners", "Healthy Meals", "Desserts"].map((name) => (
              <Pressable
                key={name}
                onPress={() => handleQuickCreateAndAdd(name)}
                style={styles.collectionChip}
              >
                <Text style={styles.collectionChipText}>{name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <TextInput
        value={collectionName}
        onChangeText={setCollectionName}
        placeholder="New collection name"
        placeholderTextColor={colors.muted}
        style={styles.formInput}
      />
      <Pressable onPress={handleCreateAndAdd} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Create and add</Text>
      </Pressable>
    </View>
  );
}

function ReviewForm({ existingReview, onSaveReview }) {
  const [rating, setRating] = useState(existingReview?.rating || 5);
  const [comment, setComment] = useState(existingReview?.comment || "");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setRating(existingReview?.rating || 5);
    setComment(existingReview?.comment || "");
  }, [existingReview?.comment, existingReview?.rating]);

  async function handleSubmit() {
    setIsSaving(true);
    setStatus("");

    try {
      await onSaveReview({ comment, rating });
      setStatus("Review saved.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.reviewForm}>
      <Text style={styles.reviewFormTitle}>
        {existingReview ? "Update your review" : "Add your review"}
      </Text>
      <View style={styles.ratingPicker}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => setRating(value)}
            style={[styles.ratingButton, rating >= value && styles.ratingButtonActive]}
          >
            <Text
              style={[
                styles.ratingButtonText,
                rating >= value && styles.ratingButtonTextActive
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Share a short cooking note"
        placeholderTextColor={colors.muted}
        style={styles.reviewInput}
        multiline
      />
      {status ? (
        <Text style={status === "Review saved." ? styles.successText : styles.errorText}>
          {status}
        </Text>
      ) : null}
      <Pressable
        onPress={handleSubmit}
        disabled={isSaving}
        style={[styles.primaryButton, isSaving && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>
          {isSaving ? "Saving..." : existingReview ? "Update review" : "Post review"}
        </Text>
      </Pressable>
    </View>
  );
}

function ReviewRow({ review }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewName}>{review.userName}</Text>
        <Text style={styles.reviewRating}>{review.rating}/5</Text>
      </View>
      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
    </View>
  );
}

function CookingModeScreen({ recipe, onBack }) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = recipe.steps.length ? recipe.steps : ["Follow the recipe details."];
  const currentStep = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <SafeAreaView style={styles.lightSafeArea}>
      <StatusBar style="dark" />
      <View style={styles.cookingScreen}>
        <View style={styles.lightHeader}>
          <Pressable onPress={onBack}>
            <Text style={styles.lightIcon}>Back</Text>
          </Pressable>
          <Text style={styles.cookingStepLabel}>
            Step {stepIndex + 1} of {steps.length}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.cookingTitle}>{recipe.title}</Text>
        <Text style={styles.cookingInstruction}>{currentStep}</Text>
        <Image source={{ uri: recipe.image }} style={styles.cookingImage} />
        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>08:00</Text>
          <Text style={styles.timerLabel}>Cooking timer</Text>
        </View>
        <View style={styles.cookingControls}>
          <Pressable
            disabled={stepIndex === 0}
            onPress={() => setStepIndex((value) => Math.max(0, value - 1))}
            style={[styles.secondaryButton, stepIndex === 0 && styles.disabledButton]}
          >
            <Text style={styles.secondaryButtonText}>Previous</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setStepIndex((value) => Math.min(steps.length - 1, value + 1))
            }
            style={styles.primaryButtonSmall}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({ shoppingCount, onOpenShoppingList, onSessionChange }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit() {
    setIsSubmitting(true);
    setStatus("");

    try {
      const nextSession = isSignup
        ? await signUp({ email, password, fullName })
        : await signIn({ email, password });

      onSessionChange(nextSession);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.authContainer}>
      <View style={styles.authArt}>
        <Text style={styles.authArtText}>Welcome Back!</Text>
      </View>
      <Text style={styles.lightTitle}>
        {isSignup ? "Create your account" : "Login to continue"}
      </Text>
      <Text style={styles.lightSubtitle}>
        Save favorites, unlock premium recipes, and keep cooking.
      </Text>

      <View style={styles.authModeRow}>
        <Pressable
          onPress={() => setMode("login")}
          style={[styles.authModeButton, !isSignup && styles.authModeButtonActive]}
        >
          <Text style={[styles.authModeText, !isSignup && styles.authModeTextActive]}>
            Login
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("signup")}
          style={[styles.authModeButton, isSignup && styles.authModeButtonActive]}
        >
          <Text style={[styles.authModeText, isSignup && styles.authModeTextActive]}>
            Sign up
          </Text>
        </Pressable>
      </View>

      {isSignup ? (
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          style={styles.formInput}
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email address"
        placeholderTextColor={colors.muted}
        style={styles.formInput}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        style={styles.formInput}
      />
      <Text style={styles.forgotText}>Forgot Password?</Text>
      {status ? <Text style={styles.errorText}>{status}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Login"}
        </Text>
      </Pressable>
      <View style={styles.socialRow}>
        <View style={styles.socialButton}>
          <Text style={styles.socialText}>Google</Text>
        </View>
        <View style={styles.socialButton}>
          <Text style={styles.socialText}>Apple</Text>
        </View>
      </View>
      <Pressable onPress={onOpenShoppingList} style={styles.authShoppingCard}>
        <View>
          <Text style={styles.authShoppingTitle}>Shopping List</Text>
          <Text style={styles.authShoppingText}>
            {shoppingCount} ingredient{shoppingCount === 1 ? "" : "s"} saved on this device
          </Text>
        </View>
        <Text style={styles.menuArrow}>{">"}</Text>
      </Pressable>
    </View>
  );
}

function ProfileScreen({
  favoriteError,
  session,
  savedRecipes,
  hasSubscription,
  collectionsCount,
  shoppingCount,
  onLogout,
  onOpenCollections,
  onOpenSubscription,
  onOpenShoppingList,
  onSessionChange
}) {
  const [fullName, setFullName] = useState(session.user.fullName);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setStatus("");

    try {
      const updatedSession = await updateProfile({ session, fullName });
      onSessionChange(updatedSession);
      setStatus("Profile updated.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileTop}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {session.user.fullName?.slice(0, 1).toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.lightTitle}>{session.user.fullName}</Text>
        <Text style={styles.lightSubtitle}>{session.user.email}</Text>
      </View>
      {favoriteError ? <Text style={styles.errorText}>{favoriteError}</Text> : null}

      <View style={styles.statsRow}>
        <StatTile value={savedRecipes.length} label="Recipes Saved" />
        <StatTile value={collectionsCount} label="Collections" />
        <StatTile value="2.4k" label="Minutes Cooked" />
      </View>

      <View style={styles.subscriptionPanel}>
        <Text style={styles.subscriptionLabel}>Subscription</Text>
        <Text style={styles.subscriptionTitle}>
          {hasSubscription ? "Premium active" : "Free plan"}
        </Text>
        <Text style={styles.subscriptionText}>
          {hasSubscription
            ? "All premium recipes are unlocked on this device."
            : "Read free recipes now. Premium recipes stay locked until subscription is active."}
        </Text>
        <Pressable
          style={[styles.primaryButton, hasSubscription && styles.greenButton]}
          onPress={onOpenSubscription}
        >
          <Text style={styles.primaryButtonText}>
            {hasSubscription ? "Manage subscription" : "View premium plan"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          style={styles.formInput}
        />
        {status ? (
          <Text style={status === "Profile updated." ? styles.successText : styles.errorText}>
            {status}
          </Text>
        ) : null}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.primaryButton, isSaving && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving..." : "Save profile"}
          </Text>
        </Pressable>
        <Pressable onPress={onLogout} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.menuPanel}>
        <View style={styles.menuRow}>
          <Text style={styles.menuText}>Cooking History</Text>
          <Text style={styles.menuArrow}>{">"}</Text>
        </View>
        <Pressable onPress={onOpenCollections} style={styles.menuRow}>
          <View>
            <Text style={styles.menuText}>My Collections</Text>
            <Text style={styles.menuSubtext}>{collectionsCount} collections</Text>
          </View>
          <Text style={styles.menuArrow}>{">"}</Text>
        </Pressable>
        <Pressable onPress={onOpenShoppingList} style={styles.menuRow}>
          <View>
            <Text style={styles.menuText}>Shopping List</Text>
            <Text style={styles.menuSubtext}>{shoppingCount} saved items</Text>
          </View>
          <Text style={styles.menuArrow}>{">"}</Text>
        </Pressable>
        <View style={styles.menuRow}>
          <Text style={styles.menuText}>Settings</Text>
          <Text style={styles.menuArrow}>{">"}</Text>
        </View>
        <View style={styles.menuRow}>
          <Text style={styles.menuText}>Help & Support</Text>
          <Text style={styles.menuArrow}>{">"}</Text>
        </View>
      </View>
      <View style={styles.bottomSpacer} />
    </View>
  );
}

function SubscriptionScreen({ hasSubscription, onBack, onPreviewChange }) {
  return (
    <SafeAreaView style={styles.darkSafeArea}>
      <StatusBar style="light" />
      <ScrollView style={styles.darkScreen} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.darkBackButton}>
          <Text style={styles.darkBackText}>Back to recipes</Text>
        </Pressable>

        <View style={styles.paywallHero}>
          <Text style={styles.subscriptionLabel}>World Recipes Premium</Text>
          <Text style={styles.paywallTitle}>Unlock every country, every recipe.</Text>
          <Text style={styles.subscriptionText}>
            Start with free recipes, then upgrade when you want the complete
            recipe library and new premium dishes.
          </Text>
          <View style={styles.paywallDivider} />
          <View style={styles.paywallPriceRow}>
            <Text style={styles.paywallPrice}>Rs. 99</Text>
            <Text style={styles.paywallPeriod}>/ month</Text>
          </View>
          <Benefit text="Unlimited premium recipe access" />
          <Benefit text="Recipes from every published country" />
          <Benefit text="New premium dishes as you add them from admin" />
          <Pressable
            style={[styles.primaryButton, hasSubscription && styles.greenButton]}
            onPress={() => onPreviewChange(!hasSubscription)}
          >
            <Text style={styles.primaryButtonText}>
              {hasSubscription ? "Premium preview active" : "Preview unlock for testing"}
            </Text>
          </Pressable>
          <Text style={styles.paywallFootnote}>
            Payment will connect to RevenueCat before app store launch.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ text }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitDot} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function CompactRecipeRow({ recipe, saved, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.compactRow}>
      <Image source={{ uri: recipe.image }} style={styles.compactImage} />
      <View style={styles.compactCopy}>
        <Text style={styles.compactTitle}>{recipe.title}</Text>
        <Text style={styles.compactMeta}>
          {recipe.timeMinutes} min - {recipe.difficulty}
        </Text>
      </View>
      <Text style={styles.compactSave}>{saved ? "Saved" : recipe.isPremium ? "Pro" : ""}</Text>
    </Pressable>
  );
}

function RecipeSection({ title, items, numbered = false }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? (
        items.map((item, index) => (
          <View key={`${title}-${item}-${index}`} style={styles.listItem}>
            <Text style={styles.bullet}>{numbered ? `${index + 1}` : "-"}</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Not added yet.</Text>
      )}
    </View>
  );
}

function InfoPanel({ title, body }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.listText}>{body}</Text>
    </View>
  );
}

function SectionHeader({ title, action }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionAction}>{action}</Text>
    </View>
  );
}

function StatTile({ value, label }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BottomNav({ currentView, signedIn, onChange }) {
  const items = [
    ["home", "Home"],
    ["explore", "Explore"],
    ["favorites", "Favorites"],
    ["profile", signedIn ? "Profile" : "Login"]
  ];

  return (
    <View style={styles.bottomNav}>
      {items.map(([key, label]) => {
        const active = currentView === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={styles.navItem}
          >
            <View style={[styles.navDot, active && styles.navDotActive]} />
            <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const colors = {
  cream: "#FAF7F2",
  card: "#FFFFFF",
  dark: "#050505",
  darkSoft: "#111111",
  ink: "#18120F",
  muted: "#786F67",
  line: "#E9DDD1",
  accent: "#FF6B2C",
  accentDark: "#E85A20",
  accentSoft: "#FFF0E8",
  green: "#1F7A52"
};

const shadows = {
  soft: {
    shadowColor: "#21160F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  }
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  darkSafeArea: {
    backgroundColor: colors.dark
  },
  lightSafeArea: {
    backgroundColor: colors.cream,
    flex: 1
  },
  lightScreen: {
    backgroundColor: colors.cream,
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16
  },
  darkScreen: {
    backgroundColor: colors.dark,
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16
  },
  entryScreen: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24
  },
  entryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.58)"
  },
  splashContent: {
    marginTop: 112,
    zIndex: 1
  },
  chefMark: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 26,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    marginBottom: 24,
    width: 52
  },
  chefMarkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900"
  },
  splashTitle: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 48
  },
  accentText: {
    color: colors.accent
  },
  splashSubtitle: {
    color: "#F5E8DE",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 22,
    maxWidth: 260
  },
  entryFooter: {
    paddingBottom: 24,
    zIndex: 1
  },
  entryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16
  },
  entryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  },
  entryHint: {
    color: "#F5E8DE",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center"
  },
  skipButton: {
    alignSelf: "flex-end",
    marginTop: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
    zIndex: 1
  },
  skipText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  onboardingCopy: {
    alignItems: "center",
    marginTop: 76,
    zIndex: 1
  },
  onboardingTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 38,
    maxWidth: 300,
    textAlign: "center"
  },
  onboardingBody: {
    color: "#F5E8DE",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 270,
    textAlign: "center"
  },
  onboardingDots: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 18
  },
  onboardingDot: {
    backgroundColor: "rgba(255, 255, 255, 0.48)",
    borderRadius: 5,
    height: 8,
    width: 8
  },
  onboardingDotActive: {
    backgroundColor: colors.accent,
    width: 20
  },
  feedList: {
    paddingBottom: 92
  },
  feedCardShell: {
    height: feedCardHeight,
    paddingHorizontal: 14,
    paddingTop: 10
  },
  feedCard: {
    flex: 1,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 16
  },
  feedCardImage: {
    borderRadius: 24
  },
  feedShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 24
  },
  feedTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 1
  },
  feedGreeting: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  feedBrand: {
    color: "#F4E4D7",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  profileBubble: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  profileBubbleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  feedTopActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  notificationBubble: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.13)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 48
  },
  notificationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900"
  },
  feedSearchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.13)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 18,
    borderWidth: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    height: 48,
    marginTop: 14,
    paddingHorizontal: 16,
    zIndex: 1
  },
  feedSearchText: {
    color: "#D8D0CA",
    fontSize: 13,
    fontWeight: "700"
  },
  feedBody: {
    paddingBottom: 74,
    zIndex: 1
  },
  feedBadgeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  feedProgressText: {
    color: "#F3E7DE",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8
  },
  trendingBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.54)",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  trendingBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  roundAction: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.13)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  roundActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900"
  },
  feedTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    maxWidth: 330
  },
  feedMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10
  },
  feedMeta: {
    color: "#F3E7DE",
    fontSize: 13,
    fontWeight: "800"
  },
  feedDescription: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 330
  },
  feedError: {
    color: "#FFD6C4",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8
  },
  feedCtaButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    marginTop: 18,
    paddingVertical: 15
  },
  feedCtaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900"
  },
  feedDots: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 14
  },
  feedDot: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 4,
    height: 7,
    width: 7
  },
  feedDotActive: {
    backgroundColor: colors.accent,
    width: 18
  },
  feedState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28
  },
  feedStateTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center"
  },
  feedStateText: {
    color: "#D8D0CA",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center"
  },
  lightHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  lightTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34
  },
  lightSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    textAlign: "center"
  },
  lightIcon: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  searchInput: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    height: 52,
    paddingHorizontal: 16,
    ...shadows.soft
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 22
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  sectionAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900"
  },
  categoryScroller: {
    gap: 12,
    paddingRight: 18
  },
  categoryChip: {
    alignItems: "center",
    borderRadius: 18,
    minWidth: 78,
    padding: 6
  },
  categoryChipActive: {
    backgroundColor: colors.accent
  },
  categoryIcon: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.accent,
    fontSize: 16,
    fontWeight: "900",
    height: 46,
    paddingTop: 12,
    textAlign: "center",
    width: 46
  },
  categoryIconActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
    color: colors.accent
  },
  categoryText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7
  },
  categoryTextActive: {
    color: "#FFFFFF"
  },
  categoryCount: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3
  },
  countryScroller: {
    gap: 12,
    paddingRight: 18
  },
  countryCuisine: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 108,
    padding: 12,
    ...shadows.soft
  },
  countryCuisineActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  countryCuisineTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  countryCuisineTitleActive: {
    color: "#FFFFFF"
  },
  countryCuisineCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5
  },
  countryCuisineCountActive: {
    color: "#FFE7DC"
  },
  recipeStrip: {
    gap: 12,
    paddingRight: 18
  },
  stripCard: {
    width: 132
  },
  stripImage: {
    borderRadius: 16,
    height: 96,
    width: 132
  },
  stripTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8
  },
  stripMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3
  },
  compactRow: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 10,
    ...shadows.soft
  },
  compactImage: {
    borderRadius: 14,
    height: 70,
    width: 86
  },
  compactCopy: {
    flex: 1
  },
  compactTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  compactMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6
  },
  compactSave: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900"
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18
  },
  segmentPill: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  segmentPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  collectionCreatePanel: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
    ...shadows.soft
  },
  collectionCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
    ...shadows.soft
  },
  collectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10
  },
  collectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  collectionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  },
  collectionRecipeRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10
  },
  collectionRecipeButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10
  },
  collectionRecipeImage: {
    borderRadius: 12,
    height: 50,
    width: 58
  },
  collectionRecipeCopy: {
    flex: 1
  },
  detailHero: {
    backgroundColor: colors.dark,
    height: 330
  },
  detailImage: {
    height: "100%",
    width: "100%"
  },
  detailBackButton: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 18,
    left: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    top: 18
  },
  detailBackText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  detailSaveButton: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    right: 18,
    top: 18
  },
  detailSaveButtonActive: {
    backgroundColor: colors.accent
  },
  detailSaveText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  detailSaveTextActive: {
    color: "#FFFFFF"
  },
  detailContent: {
    backgroundColor: colors.cream,
    padding: 18
  },
  detailSheet: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: -64,
    padding: 18,
    ...shadows.soft
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34
  },
  detailMeta: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  detailSubtext: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14
  },
  ratingText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "900"
  },
  ratingCopy: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  detailTabs: {
    gap: 10,
    paddingVertical: 18
  },
  detailTab: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  detailTabActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  detailTabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  detailTabTextActive: {
    color: "#FFFFFF"
  },
  ingredientRow: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    padding: 10
  },
  ingredientImage: {
    borderRadius: 12,
    height: 50,
    width: 50
  },
  ingredientCopy: {
    flex: 1
  },
  ingredientTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  ingredientMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  addButton: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "900"
  },
  addIngredientButton: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  reviewForm: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    marginTop: 12,
    padding: 12
  },
  reviewFormTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  ratingPicker: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  ratingButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 38
  },
  ratingButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  ratingButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  ratingButtonTextActive: {
    color: "#FFFFFF"
  },
  reviewInput: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    minHeight: 88,
    padding: 12,
    textAlignVertical: "top"
  },
  reviewList: {
    gap: 10,
    marginTop: 14
  },
  reviewRow: {
    backgroundColor: colors.cream,
    borderRadius: 14,
    padding: 12
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  reviewName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  reviewRating: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900"
  },
  reviewComment: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8
  },
  detailCollectionAction: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  detailCollectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  detailCollectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3
  },
  detailCollectionPlus: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    height: 34,
    lineHeight: 32,
    textAlign: "center",
    width: 34
  },
  modalBackdrop: {
    backgroundColor: "rgba(25, 17, 12, 0.56)",
    flex: 1,
    justifyContent: "flex-end"
  },
  collectionSheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "78%",
    padding: 18
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#D8C9BC",
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 42
  },
  collectionSheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  sheetEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 4
  },
  sheetCloseButton: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  sheetCloseText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  detailCollectionBox: {
    paddingTop: 4
  },
  collectionChipRow: {
    gap: 8,
    paddingTop: 12
  },
  quickCollectionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  collectionChip: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  collectionChipActive: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  collectionChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  collectionChipTextActive: {
    color: "#FFFFFF"
  },
  stickyCta: {
    backgroundColor: colors.cream,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 10
  },
  cookingScreen: {
    backgroundColor: colors.cream,
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16
  },
  cookingStepLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: 5,
    height: 6,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.accent,
    height: 6
  },
  cookingTitle: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    marginTop: 28
  },
  cookingInstruction: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 28,
    marginTop: 18
  },
  cookingImage: {
    borderRadius: 22,
    height: 260,
    marginTop: 24,
    width: "100%"
  },
  timerCircle: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderRadius: 42,
    borderWidth: 3,
    height: 84,
    justifyContent: "center",
    marginTop: -32,
    width: 84
  },
  timerText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  timerLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  cookingControls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30
  },
  authContainer: {
    paddingBottom: 110,
    paddingTop: 12
  },
  authArt: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 48,
    height: 96,
    justifyContent: "center",
    marginBottom: 18,
    width: 96
  },
  authArtText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  authModeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22
  },
  authModeButton: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  authModeButtonActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  authModeText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center"
  },
  authModeTextActive: {
    color: "#FFFFFF"
  },
  formInput: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    height: 52,
    marginTop: 12,
    paddingHorizontal: 16
  },
  forgotText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "right"
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16
  },
  socialButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13
  },
  socialText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  authShoppingCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    padding: 14,
    ...shadows.soft
  },
  authShoppingTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  authShoppingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    marginTop: 16,
    paddingVertical: 15
  },
  primaryButtonSmall: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 24,
    minWidth: 120,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  greenButton: {
    backgroundColor: colors.green
  },
  disabledButton: {
    opacity: 0.55
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  profileContainer: {
    paddingBottom: 28,
    paddingTop: 12
  },
  profileTop: {
    alignItems: "center",
    marginBottom: 20
  },
  profileAvatar: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: 46,
    borderWidth: 2,
    height: 92,
    justifyContent: "center",
    marginBottom: 12,
    width: 92
  },
  profileAvatarText: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: "900"
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  statTile: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 12
  },
  statValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center"
  },
  subscriptionPanel: {
    backgroundColor: colors.ink,
    borderRadius: 22,
    marginBottom: 16,
    padding: 18
  },
  subscriptionLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  subscriptionTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6
  },
  subscriptionText: {
    color: "#F1E5DC",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
  },
  paywallHero: {
    backgroundColor: colors.darkSoft,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 16,
    padding: 20
  },
  paywallTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40,
    marginTop: 10
  },
  darkBackButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  darkBackText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900"
  },
  paywallDivider: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    height: 1,
    marginVertical: 18
  },
  paywallPriceRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    marginBottom: 18
  },
  paywallPrice: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900"
  },
  paywallPeriod: {
    color: "#E5D8CE",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
    marginLeft: 6
  },
  benefitRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  benefitDot: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    height: 12,
    width: 12
  },
  benefitText: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21
  },
  paywallFootnote: {
    color: "#E5D8CE",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 12,
    textAlign: "center"
  },
  panel: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    ...shadows.soft
  },
  menuPanel: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden"
  },
  menuRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15
  },
  menuText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  menuSubtext: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  menuArrow: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: "900"
  },
  listSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4
  },
  clearListButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  clearListText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900"
  },
  shoppingItemRow: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 12,
    ...shadows.soft
  },
  shoppingCheck: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 54
  },
  shoppingCheckActive: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  shoppingCheckText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900"
  },
  shoppingCheckTextActive: {
    color: "#FFFFFF"
  },
  shoppingCopy: {
    flex: 1
  },
  shoppingTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  shoppingTitleChecked: {
    color: colors.muted,
    textDecorationLine: "line-through"
  },
  shoppingMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  deleteItemButton: {
    backgroundColor: colors.cream,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  deleteItemText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900"
  },
  stateBox: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 26
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    textAlign: "center"
  },
  listItem: {
    flexDirection: "row",
    gap: 10,
    marginTop: 11
  },
  bullet: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "900",
    minWidth: 22
  },
  listText: {
    color: "#3A302A",
    flex: 1,
    fontSize: 15,
    lineHeight: 22
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10
  },
  errorText: {
    color: "#A93720",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  },
  successText: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  },
  bottomNav: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "absolute",
    width: "92%",
    ...shadows.soft
  },
  navItem: {
    alignItems: "center",
    flex: 1
  },
  navDot: {
    backgroundColor: "transparent",
    borderRadius: 4,
    height: 7,
    marginBottom: 5,
    width: 7
  },
  navDotActive: {
    backgroundColor: colors.accent
  },
  navText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  navTextActive: {
    color: colors.accent,
    fontWeight: "900"
  },
  bottomSpacer: {
    height: 104
  }
});
