# World Recipes

A cross-platform recipe app for iOS and Android built with React Native Expo.

## Current App

- Browse recipes from different countries
- Search by recipe, country, ingredient, or tag
- Filter recipes by country
- Open a recipe detail view with image, ingredients, and cooking steps
- Create account, login, logout, and edit profile name
- Local recipe data that can later move into Supabase

## Recommended Full-Stack Setup

- Mobile app: React Native Expo
- Backend: Supabase
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Recipe images: Supabase Storage
- Admin website: Next.js or React
- Admin hosting: Hostinger
- Code storage: GitHub

The mobile app itself is published through the Apple App Store and Google Play Store. Hostinger is best used for the admin website where recipes are uploaded and managed.

## Run Locally

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm start
```

Then scan the QR code with the Expo Go app on your phone.

## Supabase Setup Later

Copy `.env.example` to `.env` and fill in:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

The first version uses local sample data. The next backend step is to create Supabase tables for countries, recipes, ingredients, steps, favorites, and admin uploads.

When the two Expo public keys are empty, the app automatically uses sample recipes and demo auth. After you add real Supabase keys and run the SQL schema, the app will load published recipes from Supabase and use Supabase Auth for real accounts.

## GitHub

This folder is initialized as a local Git repository. To push it to GitHub, create an empty GitHub repository, then run:

```bash
git remote add origin YOUR_GITHUB_REPO_URL
git add .
git commit -m "Initial recipe app"
git branch -M main
git push -u origin main
```
