# Fleet Ledger

A responsive fleet register for tracking insurance expiry, next service date, revenue licence expiry, and emissions test expiry. This static site is suitable for GitHub Pages; Supabase provides the shared database.

## Set up the shared database

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. In the project dashboard, open **SQL Editor**, paste in `supabase-setup.sql`, and run it.
3. In **Project Settings → API Keys** (or the project’s **Connect** dialog), copy the Project URL and the **publishable key** (starts with `sb_publishable_`). The app sends this key in the `apikey` header; it is not a user JWT.
4. Open `config.js` and replace `YOUR_PROJECT_ID` and `YOUR_SUPABASE_ANON_KEY` with those values.

The database policies allow anyone on the internet to read vehicle details and add records without signing in. The app does not provide edit or delete controls. Do not store sensitive personal information in this public fleet register.

## Publish with GitHub Pages

1. Create a GitHub repository and upload the files in this folder.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, then choose `main` and `/ (root)`.
4. Save and open the published URL shown in the Pages section.

Because this is a static site, `config.js` must be present in the published repository. The Supabase anon key is intended for browser use; database policies control the public access described above. Never put a Supabase `service_role` key in the browser app.

## Local preview

Open `index.html` in a browser after configuring `config.js`, or serve the folder with any static file server.
