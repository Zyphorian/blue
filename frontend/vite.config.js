import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// `base` is the deployment sub-path. The site is published to GitHub Pages as
// https://zyphorian.github.io/blue/, so every generated URL (JS/CSS bundles,
// imported assets, and import.meta.env.BASE_URL which the app uses for the files
// in public/) must be prefixed with /blue/. Without this the built index.html
// points at /assets/... on the domain root and the whole site loads unstyled with
// no images - the exact symptom on the live deployment.
//
// Local dev is then served from http://localhost:5173/blue/ (Vite prints the URL).
export default defineConfig({
  base: '/blue/',
  plugins: [react()],
  build: {
    // Keep the sourcemap noise out of the published build.
    sourcemap: false,
    // A couple of the bundled assets are large (the hero banner, the generated
    // skin data), so raise the warning threshold rather than hiding real ones.
    chunkSizeWarningLimit: 1200,
  },
})
