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
import { getRecipes } from "./src/services/recipeService";

export default function App() {
  const [recipes, setRecipes] = useState([]);
  const [recipeSource, setRecipeSource] = useState("local");
  const [recipeError, setRecipeError] = useState(null);
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
            <RecipeCard recipe={item} onPress={() => setActiveRecipe(item)} />
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

function RecipeCard({ recipe, onPress }) {
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
  header: {
    paddingTop: 20,
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
