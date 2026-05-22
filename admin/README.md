# World Recipes Admin Panel

This is a static admin website for Hostinger. Upload this `admin` folder to your Hostinger site after adding Supabase config.

## Setup

1. Create a Supabase project.
2. Run `docs/supabase-schema.sql` in the Supabase SQL editor.
3. Create an admin user in Supabase Authentication.
4. Add that user to the `admins` table:

```sql
insert into admins (user_id, email)
values ('USER_ID_FROM_AUTH_USERS', 'admin@example.com');
```

5. Open `admin/config.js` and add:

```js
window.WORLD_RECIPES_ADMIN_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

6. Upload the `admin` folder to Hostinger.

## What It Does

- Admin login with Supabase Auth
- Create countries automatically
- Upload recipe title, country, region, time, servings, image file or image URL, tags, ingredients, and steps
- Publish or save recipe as unpublished
- Review uploaded recipes, publish/unpublish them, and delete recipes

Only users listed in the `admins` table can upload recipe content.

## Image Uploads

The SQL setup creates a public Supabase Storage bucket named `recipe-images`. Admin users can upload images into that bucket from this panel, and the mobile app reads the public image URL saved on each recipe.
