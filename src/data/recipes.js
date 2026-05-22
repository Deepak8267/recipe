export const recipes = [
  {
    id: "in-butter-chicken",
    title: "Butter Chicken",
    country: "India",
    region: "North India",
    timeMinutes: 45,
    difficulty: "Medium",
    servings: 4,
    image:
      "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=1200&q=80",
    tags: ["Chicken", "Dinner", "Creamy"],
    ingredients: [
      "500 g chicken pieces",
      "1 cup tomato puree",
      "1/2 cup cream",
      "2 tbsp butter",
      "1 tbsp ginger garlic paste",
      "1 tsp garam masala",
      "Salt to taste"
    ],
    steps: [
      "Marinate chicken with salt, ginger garlic paste, and spices.",
      "Cook chicken in butter until lightly browned.",
      "Add tomato puree and simmer until the sauce thickens.",
      "Stir in cream and garam masala, then cook for 5 minutes.",
      "Serve hot with naan or rice."
    ]
  },
  {
    id: "it-spaghetti-pomodoro",
    title: "Spaghetti Pomodoro",
    country: "Italy",
    region: "Campania",
    timeMinutes: 30,
    difficulty: "Easy",
    servings: 2,
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80",
    tags: ["Pasta", "Vegetarian", "Quick"],
    ingredients: [
      "200 g spaghetti",
      "2 cups crushed tomatoes",
      "2 garlic cloves",
      "2 tbsp olive oil",
      "Fresh basil",
      "Salt and pepper"
    ],
    steps: [
      "Boil spaghetti in salted water until al dente.",
      "Warm olive oil and gently cook sliced garlic.",
      "Add tomatoes, salt, and pepper, then simmer for 15 minutes.",
      "Toss pasta with sauce and basil.",
      "Serve with extra olive oil."
    ]
  },
  {
    id: "jp-miso-ramen",
    title: "Miso Ramen",
    country: "Japan",
    region: "Hokkaido",
    timeMinutes: 50,
    difficulty: "Medium",
    servings: 2,
    image:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80",
    tags: ["Noodles", "Soup", "Comfort"],
    ingredients: [
      "2 ramen noodle portions",
      "3 cups chicken or vegetable stock",
      "2 tbsp miso paste",
      "1 tsp soy sauce",
      "Corn, egg, spring onion, and mushrooms",
      "Chili oil optional"
    ],
    steps: [
      "Heat stock and dissolve miso paste into it.",
      "Add soy sauce and simmer gently.",
      "Cook noodles separately and place in bowls.",
      "Pour broth over noodles and add toppings.",
      "Finish with chili oil if desired."
    ]
  },
  {
    id: "mx-tacos",
    title: "Street Tacos",
    country: "Mexico",
    region: "Central Mexico",
    timeMinutes: 35,
    difficulty: "Easy",
    servings: 4,
    image:
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=1200&q=80",
    tags: ["Beef", "Street Food", "Fresh"],
    ingredients: [
      "8 small corn tortillas",
      "400 g grilled beef or chicken",
      "1 onion, chopped",
      "Fresh coriander",
      "Lime wedges",
      "Salsa",
      "Salt to taste"
    ],
    steps: [
      "Season and grill the meat until cooked through.",
      "Warm tortillas on a hot pan.",
      "Slice meat and place it in tortillas.",
      "Top with onion, coriander, salsa, and lime.",
      "Serve immediately."
    ]
  },
  {
    id: "ma-tagine",
    title: "Vegetable Tagine",
    country: "Morocco",
    region: "Marrakesh",
    timeMinutes: 55,
    difficulty: "Medium",
    servings: 4,
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
    tags: ["Vegetarian", "Stew", "Spiced"],
    ingredients: [
      "2 cups mixed vegetables",
      "1 cup chickpeas",
      "1 onion",
      "2 tomatoes",
      "1 tsp cumin",
      "1 tsp cinnamon",
      "Vegetable stock"
    ],
    steps: [
      "Cook onion with spices until fragrant.",
      "Add tomatoes, vegetables, chickpeas, and stock.",
      "Cover and simmer until vegetables are tender.",
      "Adjust seasoning.",
      "Serve with couscous or bread."
    ]
  },
  {
    id: "th-green-curry",
    title: "Thai Green Curry",
    country: "Thailand",
    region: "Central Thailand",
    timeMinutes: 40,
    difficulty: "Medium",
    servings: 3,
    image:
      "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=1200&q=80",
    tags: ["Curry", "Coconut", "Spicy"],
    ingredients: [
      "2 tbsp green curry paste",
      "1 can coconut milk",
      "300 g chicken or tofu",
      "1 cup vegetables",
      "Thai basil",
      "1 tsp sugar",
      "1 tbsp fish sauce or soy sauce"
    ],
    steps: [
      "Fry curry paste until aromatic.",
      "Add coconut milk and bring to a simmer.",
      "Add protein and vegetables.",
      "Season with sugar and fish sauce or soy sauce.",
      "Finish with Thai basil and serve with rice."
    ]
  }
];

export const countries = ["All", ...new Set(recipes.map((recipe) => recipe.country))];
