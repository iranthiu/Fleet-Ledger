# Fleet Ledger enhanced update

This folder contains a UI and schema update inspired by the supplied vehicle-management screenshot.

## Added

- Vehicle profile fields for fuel type, transmission, current odometer, and service intervals.
- Insurance, revenue licence, and emissions-test provider details.
- A dual-trigger service target based on kilometres and months.
- Service history, odometer readings, and a document vault for document links.
- A vehicle selector and health, expiry, service, and odometer summary cards.
- An all-vehicles overview by default, with fleet-wide compliance and service status. Selecting a vehicle opens its individual details.
- An update-details action for existing vehicles. It records a new profile revision, so the shared app does not need public row-edit permission.

## Apply to the GitHub Pages repository

1. Back up the repository first.
2. In Supabase SQL Editor, run `supabase-upgrade.sql`. It adds columns and tables without replacing existing vehicle rows.
3. Replace the repository-root `index.html`, `app.js`, and `styles.css` with these files. Keep the existing `config.js` and its project URL/publishable key.
4. Commit and push. GitHub Pages will publish the updated app.

The existing public read/add access remains the model for the new records. The document vault stores links to documents rather than uploading files. The SQL upgrade is additive and preserves existing vehicle rows.
