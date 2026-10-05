# Dice Dungeon

An old-school dice-based dungeon crawler.

## Run Locally

**Prerequisites:** Node.js 20 or newer

1. Install dependencies:
   `npm install`
2. Start the development server:
   `npm run dev`
3. Open http://localhost:3000

On Windows, if npm reports that `vite` or `tsc` cannot be found, rename the local project folder to remove the `&` character (for example, `parchment-and-peril`) and reopen it in VS Code. The ampersand can break npm's Windows command shim.

To test the production build locally:

1. Build the app: `npm run build`
2. Serve the build: `npm run preview`
3. Open the URL printed by Vite.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the app whenever changes are pushed to `main`.

1. Push this repository to GitHub, using `main` as the default branch.
2. In **Settings > Pages**, set **Source** to **GitHub Actions**.
3. Push a change to `main`, or run the workflow manually from the **Actions** tab.
4. Open the Pages URL shown in the workflow summary. For a project repository it is usually `https://<user>.github.io/<repository>/`.

The Vite configuration uses relative asset URLs, so the same build works at the repository subpath used by GitHub Pages.
