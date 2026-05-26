import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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

export default function App() {
  const [recipes, setRecipes] = useState([]);
  const [recipeError, setRecipeError] = useState(null);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [session, setSession] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [favoriteError, setFavoriteError] = useState(null);
  const [currentView, setCurrentView] = useState("recipes");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [query, setQuery] = useState("");
  const [activeRecipe, setActiveRecipe] = useState(null);

  useEffect(() => {
    loadRecipes();
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

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return recipes.filter((recipe) => {
      const matchesCountry =
        selectedCountry === "All" || recipe.country === selectedCountry;
      const searchableText = [
        recipe.title,
        recipe.country,
        recipe.region,
        recipe.difficulty,
        ...recipe.tags,
        ...recipe.ingredients
      ]
        .join(" ")
        .toLowerCase();

      return matchesCountry && searchableText.includes(normalizedQuery);
    });
  }, [query, recipes, selectedCountry]);

  const featuredRecipe =
    filteredRecipes.find((recipe) => hasSubscription || !recipe.isPremium) ??
    filteredRecipes[0] ??
    recipes.find((recipe) => hasSubscription || !recipe.isPremium) ??
    recipes[0] ??
    null;
  const featuredLocked = Boolean(featuredRecipe?.isPremium && !hasSubscription);
  const listRecipes = useMemo(
    () =>
      filteredRecipes.filter((recipe) => {
        if (featuredRecipe?.id === recipe.id) {
          return false;
        }

        return true;
      }),
    [featuredRecipe, filteredRecipes]
  );
  const savedRecipes = useMemo(
    () => recipes.filter((recipe) => favoriteIds.includes(recipe.id)),
    [favoriteIds, recipes]
  );

  function changeView(view) {
    setActiveRecipe(null);
    setCurrentView(view);
  }

  function handleLogout() {
    setSession(null);
    setFavoriteIds([]);
    setCurrentView("recipes");
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

  if (currentView === "profile") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
          <AppTabs
            currentView={currentView}
            onChange={changeView}
            signedIn={Boolean(session)}
          />
          {session ? (
            <ProfileScreen
              favoriteError={favoriteError}
              hasSubscription={hasSubscription}
              session={session}
              savedRecipes={savedRecipes}
              onSubscriptionChange={setHasSubscription}
              onLogout={handleLogout}
              onSessionChange={setSession}
            />
          ) : (
            <AuthScreen onSessionChange={setSession} />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (activeRecipe) {
    return (
      <RecipeDetailScreen
        favoriteError={favoriteError}
        recipe={activeRecipe}
        saved={favoriteIds.includes(activeRecipe.id)}
        signedIn={Boolean(session)}
        onBack={() => setActiveRecipe(null)}
        onToggleFavorite={() => toggleFavorite(activeRecipe.id)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <AppTabs
          currentView={currentView}
          onChange={changeView}
          signedIn={Boolean(session)}
        />

        <FlatList
          data={isLoadingRecipes ? [] : listRecipes}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.recipeList}
          ListHeaderComponent={
            <HomeHeader
              countries={countryStats}
              favoriteError={favoriteError}
              featuredRecipe={featuredRecipe}
              featuredLocked={featuredLocked}
              isLoading={isLoadingRecipes}
              query={query}
              recipeError={recipeError}
              recipeCount={recipes.length}
              selectedCountry={selectedCountry}
              onCountryChange={setSelectedCountry}
              onLockedRecipe={() => setCurrentView("profile")}
              onOpenRecipe={setActiveRecipe}
              onQueryChange={setQuery}
              onRetry={loadRecipes}
            />
          }
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              saved={favoriteIds.includes(item.id)}
              locked={item.isPremium && !hasSubscription}
              onPress={() => setActiveRecipe(item)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          )}
          ListEmptyComponent={
            isLoadingRecipes ? (
              <LoadingState />
            ) : (
              <EmptyState
                hasError={Boolean(recipeError)}
                onRetry={loadRecipes}
                query={query}
              />
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

function HomeHeader({
  countries,
  favoriteError,
  featuredRecipe,
  featuredLocked,
  isLoading,
  query,
  recipeError,
  recipeCount,
  selectedCountry,
  onCountryChange,
  onLockedRecipe,
  onOpenRecipe,
  onQueryChange,
  onRetry
}) {
  return (
    <View>
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>WR</Text>
          </View>
          <View>
            <Text style={styles.kicker}>World Recipes</Text>
            <Text style={styles.brandSubtext}>{recipeCount} published recipes</Text>
          </View>
        </View>
        <Text style={styles.title}>Cook your way around the world</Text>
        <Text style={styles.subtitle}>
          Find real recipes by country, ingredient, and cooking style.
        </Text>
      </View>

      {recipeError ? (
        <InlineMessage message={recipeError} tone="error" onRetry={onRetry} />
      ) : null}
      {favoriteError ? <InlineMessage message={favoriteError} tone="error" /> : null}

      {featuredRecipe && !isLoading ? (
        <Pressable
          style={[styles.featuredCard, featuredLocked && styles.lockedCard]}
          onPress={() =>
            featuredLocked ? onLockedRecipe() : onOpenRecipe(featuredRecipe)
          }
        >
          <Image source={{ uri: featuredRecipe.image }} style={styles.featuredImage} />
          {featuredLocked ? (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockBadge}>Premium</Text>
            </View>
          ) : null}
          <View style={styles.featuredBody}>
            <Text style={styles.featuredLabel}>
              {featuredLocked ? "Premium Preview" : "Featured"}
            </Text>
            <Text style={styles.featuredTitle}>{featuredRecipe.title}</Text>
            <Text style={styles.featuredMeta}>
              {featuredLocked
                ? "Subscribe to unlock this recipe"
                : `${featuredRecipe.country} - ${featuredRecipe.timeMinutes} min - ${featuredRecipe.difficulty}`}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.searchBlock}>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search recipes, ingredients, countries"
          placeholderTextColor="#7a827c"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Browse Countries</Text>
        <Text style={styles.sectionHint}>{countries.length} filters</Text>
      </View>

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
              style={[styles.countryCard, selected && styles.countryCardSelected]}
            >
              <Text
                style={[
                  styles.countryCardTitle,
                  selected && styles.countryCardTitleSelected
                ]}
              >
                {country}
              </Text>
              <Text
                style={[
                  styles.countryCardCount,
                  selected && styles.countryCardCountSelected
                ]}
              >
                {count} recipes
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Recipes</Text>
        <Text style={styles.sectionHint}>{selectedCountry}</Text>
      </View>
    </View>
  );
}

function RecipeDetailScreen({
  favoriteError,
  recipe,
  saved,
  signedIn,
  onBack,
  onToggleFavorite
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.detailHero}>
          <Image source={{ uri: recipe.image }} style={styles.detailImage} />
          <Pressable style={styles.detailBackButton} onPress={onBack}>
            <Text style={styles.detailBackText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.detailContent}>
          <Text style={styles.countryText}>{recipe.country}</Text>
          <Text style={styles.detailTitle}>{recipe.title}</Text>
          <Text style={styles.detailSubtext}>{recipe.region}</Text>

          <View style={styles.detailMetaGrid}>
            <MetaTile label="Time" value={`${recipe.timeMinutes} min`} />
            <MetaTile label="Level" value={recipe.difficulty} />
            <MetaTile label="Serves" value={`${recipe.servings}`} />
          </View>

          {recipe.tags.length ? (
            <View style={styles.tagRow}>
              {recipe.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={onToggleFavorite}
            style={[styles.favoriteButton, saved && styles.favoriteButtonSaved]}
          >
            <Text
              style={[
                styles.favoriteButtonText,
                saved && styles.favoriteButtonTextSaved
              ]}
            >
              {saved ? "Saved" : "Save recipe"}
            </Text>
          </Pressable>
          {!signedIn ? (
            <Text style={styles.helperText}>Login first to save this recipe.</Text>
          ) : null}
          {favoriteError ? <Text style={styles.errorText}>{favoriteError}</Text> : null}

          <RecipeSection title="Ingredients" items={recipe.ingredients} />
          <RecipeSection title="Steps" items={recipe.steps} numbered />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaTile({ label, value }) {
  return (
    <View style={styles.metaTile}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function InlineMessage({ message, tone, onRetry }) {
  return (
    <View style={[styles.inlineMessage, tone === "error" && styles.inlineError]}>
      <Text style={styles.inlineMessageText}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.inlineButton} onPress={onRetry}>
          <Text style={styles.inlineButtonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color="#e05f2f" size="large" />
      <Text style={styles.emptyTitle}>Loading recipes</Text>
      <Text style={styles.emptyText}>Fresh dishes are coming in.</Text>
    </View>
  );
}

function EmptyState({ hasError, onRetry, query }) {
  return (
    <View style={styles.stateBox}>
      <Text style={styles.emptyTitle}>
        {hasError ? "Could not load recipes" : "No recipes found"}
      </Text>
      <Text style={styles.emptyText}>
        {query ? "Try a different search or country." : "Published recipes will appear here."}
      </Text>
      {hasError ? (
        <Pressable style={styles.secondaryButton} onPress={onRetry}>
          <Text style={styles.secondaryButtonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AppTabs({ currentView, onChange, signedIn }) {
  return (
    <View style={styles.tabs}>
      <Pressable
        onPress={() => onChange("recipes")}
        style={[styles.tabButton, currentView === "recipes" && styles.tabButtonActive]}
      >
        <Text
          style={[
            styles.tabButtonText,
            currentView === "recipes" && styles.tabButtonTextActive
          ]}
        >
          Recipes
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange("profile")}
        style={[styles.tabButton, currentView === "profile" && styles.tabButtonActive]}
      >
        <Text
          style={[
            styles.tabButtonText,
            currentView === "profile" && styles.tabButtonTextActive
          ]}
        >
          {signedIn ? "Profile" : "Login"}
        </Text>
      </Pressable>
    </View>
  );
}

function AuthScreen({ onSessionChange }) {
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
      <Text style={styles.kicker}>{isSignup ? "Create Account" : "Welcome Back"}</Text>
      <Text style={styles.authTitle}>
        {isSignup ? "Start your recipe profile" : "Log in to your recipe profile"}
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
            Create
          </Text>
        </Pressable>
      </View>

      {isSignup ? (
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="#7a827c"
          style={styles.formInput}
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email address"
        placeholderTextColor="#7a827c"
        style={styles.formInput}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#7a827c"
        secureTextEntry
        style={styles.formInput}
      />

      {status ? <Text style={styles.errorText}>{status}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Login"}
        </Text>
      </Pressable>
    </View>
  );
}

function ProfileScreen({
  favoriteError,
  session,
  savedRecipes,
  hasSubscription,
  onLogout,
  onSubscriptionChange,
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
      <Text style={styles.kicker}>Profile</Text>
      <Text style={styles.authTitle}>Hello, {session.user.fullName}</Text>
      <Text style={styles.subtitle}>{session.user.email}</Text>
      {favoriteError ? <Text style={styles.errorText}>{favoriteError}</Text> : null}

      <View style={styles.subscriptionPanel}>
        <Text style={styles.subscriptionLabel}>Subscription</Text>
        <Text style={styles.subscriptionTitle}>
          {hasSubscription ? "Premium active" : "Free plan"}
        </Text>
        <Text style={styles.subscriptionText}>
          {hasSubscription
            ? "All premium recipes are unlocked on this device."
            : "Preview free recipes now. Premium unlock will connect to RevenueCat later."}
        </Text>
        <Pressable
          style={[styles.primaryButton, hasSubscription && styles.greenButton]}
          onPress={() => onSubscriptionChange(!hasSubscription)}
        >
          <Text style={styles.primaryButtonText}>
            {hasSubscription ? "Switch to free preview" : "Preview premium unlock"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="#7a827c"
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
          style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving..." : "Save profile"}
          </Text>
        </Pressable>
        <Pressable onPress={onLogout} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Saved Recipes</Text>
        {savedRecipes.length ? (
          savedRecipes.map((recipe) => (
            <View key={recipe.id} style={styles.savedRecipeRow}>
              <Image source={{ uri: recipe.image }} style={styles.savedRecipeImage} />
              <View style={styles.savedRecipeCopy}>
                <Text style={styles.savedRecipeTitle}>{recipe.title}</Text>
                <Text style={styles.savedRecipeMeta}>
                  {recipe.country} - {recipe.timeMinutes} min
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Saved recipes will appear here.</Text>
        )}
      </View>
    </View>
  );
}

function RecipeCard({ recipe, saved, locked, onPress, onToggleFavorite }) {
  function handlePress() {
    if (locked) {
      return;
    }

    onPress();
  }

  return (
    <Pressable style={[styles.card, locked && styles.lockedCard]} onPress={handlePress}>
      <Image source={{ uri: recipe.image }} style={styles.cardImage} />
      {locked ? (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockBadge}>Premium</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardCountry}>{recipe.country}</Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              if (!locked) {
                onToggleFavorite();
              }
            }}
            style={[styles.cardSaveButton, saved && styles.cardSaveButtonActive]}
          >
            <Text
              style={[
                styles.cardSaveText,
                saved && styles.cardSaveTextActive
              ]}
            >
              {locked ? "Locked" : saved ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.cardTitle}>{recipe.title}</Text>
        <Text style={styles.cardMeta}>
          {locked
            ? "Subscribe to unlock this recipe"
            : `${recipe.timeMinutes} min - ${recipe.difficulty} - Serves ${recipe.servings}`}
        </Text>
        {recipe.tags.length ? (
          <View style={styles.tagRow}>
            {recipe.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
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

const colors = {
  background: "#f5faf7",
  panel: "#ffffff",
  ink: "#17211c",
  muted: "#637168",
  line: "#dbe8df",
  green: "#1f6b4f",
  greenSoft: "#dff1e8",
  tomato: "#e05f2f",
  tomatoSoft: "#fde6da"
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  screen: {
    flex: 1,
    paddingHorizontal: 18
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14
  },
  tabButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 94,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  tabButtonActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  tabButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  tabButtonTextActive: {
    color: "#ffffff"
  },
  hero: {
    paddingTop: 22,
    paddingBottom: 18
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 15
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  logoMarkText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  kicker: {
    color: colors.tomato,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 3,
    textTransform: "uppercase"
  },
  brandSubtext: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  title: {
    color: colors.ink,
    fontSize: 33,
    fontWeight: "900",
    lineHeight: 39
  },
  authTitle: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    lineHeight: 35
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  featuredCard: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden"
  },
  featuredImage: {
    height: 190,
    width: "100%"
  },
  featuredBody: {
    padding: 16
  },
  featuredLabel: {
    color: "#b8f1d8",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
    textTransform: "uppercase"
  },
  featuredTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900"
  },
  featuredMeta: {
    color: "#dbe8df",
    fontSize: 14,
    marginTop: 6
  },
  searchBlock: {
    marginBottom: 14
  },
  searchInput: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    height: 50,
    paddingHorizontal: 14
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4
  },
  sectionEyebrow: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  countryScroller: {
    gap: 10,
    paddingBottom: 16
  },
  countryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 116,
    padding: 13
  },
  countryCardSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  countryCardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  countryCardTitleSelected: {
    color: "#ffffff"
  },
  countryCardCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5
  },
  countryCardCountSelected: {
    color: "#dff1e8"
  },
  recipeList: {
    paddingBottom: 28
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden"
  },
  lockedCard: {
    opacity: 0.82
  },
  cardImage: {
    height: 176,
    width: "100%"
  },
  lockOverlay: {
    alignItems: "flex-end",
    left: 0,
    padding: 12,
    position: "absolute",
    right: 0,
    top: 0
  },
  lockBadge: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  cardBody: {
    padding: 14
  },
  cardHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardCountry: {
    color: colors.tomato,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6
  },
  cardSaveButton: {
    backgroundColor: colors.tomatoSoft,
    borderRadius: 8,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  cardSaveButtonActive: {
    backgroundColor: colors.tomato
  },
  cardSaveText: {
    color: colors.tomato,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  cardSaveTextActive: {
    color: "#ffffff"
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  tag: {
    backgroundColor: colors.greenSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  tagText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "800"
  },
  stateBox: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 26
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    textAlign: "center"
  },
  inlineMessage: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12
  },
  inlineError: {
    backgroundColor: colors.tomatoSoft,
    borderColor: "#f3b79c"
  },
  inlineMessageText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  inlineButton: {
    alignSelf: "flex-start",
    marginTop: 10
  },
  inlineButtonText: {
    color: colors.tomato,
    fontSize: 13,
    fontWeight: "900"
  },
  detailHero: {
    backgroundColor: colors.ink
  },
  detailImage: {
    height: 330,
    width: "100%"
  },
  detailBackButton: {
    backgroundColor: "rgba(23, 33, 28, 0.88)",
    borderRadius: 8,
    left: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    top: 18
  },
  detailBackText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  detailContent: {
    backgroundColor: colors.background,
    padding: 18
  },
  countryText: {
    color: colors.tomato,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 5,
    textTransform: "uppercase"
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40
  },
  detailSubtext: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 8
  },
  detailMetaGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  metaTile: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  metaValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4
  },
  favoriteButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.panel,
    borderColor: colors.tomato,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 16,
    minWidth: 116,
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  favoriteButtonSaved: {
    backgroundColor: colors.tomato
  },
  favoriteButtonText: {
    color: colors.tomato,
    fontSize: 13,
    fontWeight: "900"
  },
  favoriteButtonTextSaved: {
    color: "#ffffff"
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12
  },
  listItem: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 11
  },
  bullet: {
    color: colors.tomato,
    fontSize: 14,
    fontWeight: "900",
    minWidth: 22
  },
  listText: {
    color: "#33423a",
    flex: 1,
    fontSize: 15,
    lineHeight: 22
  },
  authContainer: {
    paddingBottom: 28,
    paddingTop: 22
  },
  authModeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18
  },
  authModeButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
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
    color: "#ffffff"
  },
  formInput: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    height: 50,
    marginTop: 12,
    paddingHorizontal: 14
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.tomato,
    borderRadius: 8,
    marginTop: 16,
    paddingVertical: 14
  },
  greenButton: {
    backgroundColor: colors.green
  },
  primaryButtonDisabled: {
    opacity: 0.65
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  profileContainer: {
    paddingBottom: 28,
    paddingTop: 22
  },
  subscriptionPanel: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 16,
    padding: 16
  },
  subscriptionLabel: {
    color: "#b8f1d8",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  subscriptionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5
  },
  subscriptionText: {
    color: "#dbe8df",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
  },
  savedRecipeRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10
  },
  savedRecipeImage: {
    borderRadius: 8,
    height: 56,
    width: 56
  },
  savedRecipeCopy: {
    flex: 1
  },
  savedRecipeTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  savedRecipeMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3
  },
  errorText: {
    color: "#a02c20",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  },
  successText: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  }
});
