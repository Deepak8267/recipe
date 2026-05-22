import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
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
  const [recipeSource, setRecipeSource] = useState("local");
  const [recipeError, setRecipeError] = useState(null);
  const [session, setSession] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [favoriteError, setFavoriteError] = useState(null);
  const [currentView, setCurrentView] = useState("recipes");
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [query, setQuery] = useState("");
  const [activeRecipe, setActiveRecipe] = useState(null);

  useEffect(() => {
    let mounted = true;

    getRecipes().then((result) => {
      if (!mounted) {
        return;
      }

      setRecipes(result.recipes);
      setRecipeSource(result.source);
      setRecipeError(result.error ?? null);
    });

    return () => {
      mounted = false;
    };
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

  const countries = useMemo(
    () => ["All", ...new Set(recipes.map((recipe) => recipe.country))],
    [recipes]
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
        ...recipe.tags,
        ...recipe.ingredients
      ]
        .join(" ")
        .toLowerCase();

      return matchesCountry && searchableText.includes(normalizedQuery);
    });
  }, [query, recipes, selectedCountry]);

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

  const savedRecipes = useMemo(
    () => recipes.filter((recipe) => favoriteIds.includes(recipe.id)),
    [favoriteIds, recipes]
  );

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
              session={session}
              savedRecipes={savedRecipes}
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
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backButton} onPress={() => setActiveRecipe(null)}>
            <Text style={styles.backButtonText}>Back to recipes</Text>
          </Pressable>

          <Image source={{ uri: activeRecipe.image }} style={styles.detailImage} />
          <View style={styles.detailHeader}>
            <Text style={styles.countryText}>{activeRecipe.country}</Text>
            <Text style={styles.detailTitle}>{activeRecipe.title}</Text>
            <Text style={styles.detailSubtext}>
              {activeRecipe.region} - {activeRecipe.timeMinutes} min -{" "}
              {activeRecipe.difficulty} - Serves {activeRecipe.servings}
            </Text>
            <View style={styles.tagRow}>
              {activeRecipe.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={() => toggleFavorite(activeRecipe.id)}
              style={[
                styles.favoriteButton,
                favoriteIds.includes(activeRecipe.id) && styles.favoriteButtonSaved
              ]}
            >
              <Text
                style={[
                  styles.favoriteButtonText,
                  favoriteIds.includes(activeRecipe.id) &&
                    styles.favoriteButtonTextSaved
                ]}
              >
                {favoriteIds.includes(activeRecipe.id) ? "Saved" : "Save recipe"}
              </Text>
            </Pressable>
            {!session ? (
              <Text style={styles.sourceText}>Login first to save this recipe.</Text>
            ) : null}
            {favoriteError ? <Text style={styles.errorText}>{favoriteError}</Text> : null}
          </View>

          <RecipeSection title="Ingredients" items={activeRecipe.ingredients} />
          <RecipeSection title="Steps" items={activeRecipe.steps} numbered />
        </ScrollView>
      </SafeAreaView>
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
        <View style={styles.header}>
          <Text style={styles.kicker}>World Recipes</Text>
          <Text style={styles.title}>Cook dishes from different countries</Text>
          <Text style={styles.subtitle}>
            Search recipes, filter by country, and open a full cooking guide.
          </Text>
          <Text style={styles.sourceText}>
            {recipeSource === "supabase"
              ? "Connected to Supabase"
              : "Using sample recipes until Supabase keys are added"}
          </Text>
          {recipeError ? <Text style={styles.errorText}>{recipeError}</Text> : null}
          {favoriteError ? <Text style={styles.errorText}>{favoriteError}</Text> : null}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by recipe, country, ingredient..."
          placeholderTextColor="#8b7d70"
          style={styles.searchInput}
        />

        <View style={styles.countryList}>
          {countries.map((country) => {
            const selected = selectedCountry === country;
            return (
              <Pressable
                key={country}
                onPress={() => setSelectedCountry(country)}
                style={[styles.countryChip, selected && styles.countryChipSelected]}
              >
                <Text
                  style={[
                    styles.countryChipText,
                    selected && styles.countryChipTextSelected
                  ]}
                >
                  {country}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.recipeList}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              saved={favoriteIds.includes(item.id)}
              onPress={() => setActiveRecipe(item)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No recipes found</Text>
              <Text style={styles.emptyText}>
                Try another country, ingredient, or recipe name.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
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
      <Text style={styles.title}>
        {isSignup ? "Start your recipe profile" : "Log in to your recipe profile"}
      </Text>
      <Text style={styles.subtitle}>
        Use demo login now, then connect real Supabase Auth by adding your keys.
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
          placeholderTextColor="#8b7d70"
          style={styles.formInput}
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email address"
        placeholderTextColor="#8b7d70"
        style={styles.formInput}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#8b7d70"
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
  onLogout,
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
      <Text style={styles.title}>Hello, {session.user.fullName}</Text>
      <Text style={styles.subtitle}>{session.user.email}</Text>
      <Text style={styles.sourceText}>
        {session.source === "supabase"
          ? "Account connected with Supabase"
          : "Demo account until Supabase Auth is connected"}
      </Text>
      {favoriteError ? <Text style={styles.errorText}>{favoriteError}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="#8b7d70"
          style={styles.formInput}
        />
        {status ? (
          <Text style={status === "Profile updated." ? styles.sourceText : styles.errorText}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Recipes</Text>
        {savedRecipes.length ? (
          savedRecipes.map((recipe) => (
            <View key={recipe.id} style={styles.savedRecipeRow}>
              <Text style={styles.savedRecipeTitle}>{recipe.title}</Text>
              <Text style={styles.savedRecipeMeta}>
                {recipe.country} - {recipe.timeMinutes} min
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Saved recipes will appear here.</Text>
        )}
      </View>
    </View>
  );
}

function RecipeCard({ recipe, saved, onPress, onToggleFavorite }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: recipe.image }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.cardCountry}>{recipe.country}</Text>
        <Text style={styles.cardTitle}>{recipe.title}</Text>
        <Text style={styles.cardMeta}>
          {recipe.timeMinutes} min - {recipe.difficulty} - Serves {recipe.servings}
        </Text>
        <View style={styles.tagRow}>
          {recipe.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={[styles.favoriteButton, saved && styles.favoriteButtonSaved]}
        >
          <Text
            style={[
              styles.favoriteButtonText,
              saved && styles.favoriteButtonTextSaved
            ]}
          >
            {saved ? "Saved" : "Save"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function RecipeSection({ title, items, numbered = false }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <View key={`${title}-${item}`} style={styles.listItem}>
          <Text style={styles.bullet}>{numbered ? `${index + 1}.` : "-"}</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff8f0"
  },
  screen: {
    flex: 1,
    paddingHorizontal: 18
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 16
  },
  tabButton: {
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 94,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  tabButtonActive: {
    backgroundColor: "#251a13",
    borderColor: "#251a13"
  },
  tabButtonText: {
    color: "#4d4037",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  tabButtonTextActive: {
    color: "#ffffff"
  },
  header: {
    paddingTop: 18,
    paddingBottom: 18
  },
  kicker: {
    color: "#b4512b",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase"
  },
  title: {
    color: "#251a13",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36
  },
  subtitle: {
    color: "#6f6258",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  sourceText: {
    color: "#7a5d43",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10
  },
  errorText: {
    color: "#a02c20",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    color: "#251a13",
    fontSize: 15,
    height: 48,
    paddingHorizontal: 14
  },
  formInput: {
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    color: "#251a13",
    fontSize: 15,
    height: 48,
    marginTop: 12,
    paddingHorizontal: 14
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
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  authModeButtonActive: {
    backgroundColor: "#251a13",
    borderColor: "#251a13"
  },
  authModeText: {
    color: "#4d4037",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center"
  },
  authModeTextActive: {
    color: "#ffffff"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#b4512b",
    borderRadius: 8,
    marginTop: 16,
    paddingVertical: 14
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
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14
  },
  secondaryButtonText: {
    color: "#251a13",
    fontSize: 15,
    fontWeight: "900"
  },
  favoriteButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#b4512b",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    minWidth: 92,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  favoriteButtonSaved: {
    backgroundColor: "#b4512b"
  },
  favoriteButtonText: {
    color: "#b4512b",
    fontSize: 13,
    fontWeight: "900"
  },
  favoriteButtonTextSaved: {
    color: "#ffffff"
  },
  profileContainer: {
    paddingBottom: 28,
    paddingTop: 22
  },
  countryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingVertical: 14
  },
  countryChip: {
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  countryChipSelected: {
    backgroundColor: "#251a13",
    borderColor: "#251a13"
  },
  countryChipText: {
    color: "#4d4037",
    fontSize: 14,
    fontWeight: "700"
  },
  countryChipTextSelected: {
    color: "#ffffff"
  },
  recipeList: {
    gap: 14,
    paddingBottom: 28
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  cardImage: {
    height: 170,
    width: "100%"
  },
  cardBody: {
    padding: 14
  },
  cardCountry: {
    color: "#b4512b",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 3,
    textTransform: "uppercase"
  },
  cardTitle: {
    color: "#251a13",
    fontSize: 21,
    fontWeight: "900"
  },
  cardMeta: {
    color: "#6f6258",
    fontSize: 14,
    marginTop: 5
  },
  savedRecipeRow: {
    borderBottomColor: "#f3e5d7",
    borderBottomWidth: 1,
    paddingVertical: 10
  },
  savedRecipeTitle: {
    color: "#251a13",
    fontSize: 16,
    fontWeight: "900"
  },
  savedRecipeMeta: {
    color: "#6f6258",
    fontSize: 13,
    marginTop: 3
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  tag: {
    backgroundColor: "#f3e5d7",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  tagText: {
    color: "#5f3a25",
    fontSize: 12,
    fontWeight: "800"
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    padding: 26
  },
  emptyTitle: {
    color: "#251a13",
    fontSize: 18,
    fontWeight: "900"
  },
  emptyText: {
    color: "#6f6258",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center"
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#251a13",
    borderRadius: 8,
    marginBottom: 14,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  detailImage: {
    borderRadius: 8,
    height: 250,
    width: "100%"
  },
  detailHeader: {
    paddingVertical: 18
  },
  countryText: {
    color: "#b4512b",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase"
  },
  detailTitle: {
    color: "#251a13",
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 38
  },
  detailSubtext: {
    color: "#6f6258",
    fontSize: 15,
    marginTop: 8
  },
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#ead8c8",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },
  sectionTitle: {
    color: "#251a13",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12
  },
  listItem: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 10
  },
  bullet: {
    color: "#b4512b",
    fontSize: 15,
    fontWeight: "900",
    minWidth: 22
  },
  listText: {
    color: "#4d4037",
    flex: 1,
    fontSize: 15,
    lineHeight: 22
  }
});
