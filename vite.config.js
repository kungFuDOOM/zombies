// Production build for GitHub Pages (https://kungFuDOOM.github.io/zombies/).
// Local play does NOT use this: `npm start` serves the source files raw at / (server.js).
import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';

// Files that must ship untouched: import-map targets, models, voices, the service worker and
// manifest (sw.js must stay a plain file at the site root so its scope is the whole /zombies/).
const STATIC = ['vendor', 'assets', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', '.nojekyll'];

export default defineConfig({
  base: process.env.BASE_PATH || '/zombies/',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false }, // no extra inline/preload script: keeps the CSP hash valid
    rollupOptions: {
      // 'three' and 'three/addons/*' are resolved in the browser by the import map in index.html
      external: [/^three($|\/)/],
    },
  },
  plugins: [{
    name: 'copy-static',
    enforce: 'post',
    apply: 'build',
    // Vite would hash the manifest/icons (breaking the manifest's relative start_url and icon
    // paths), so point the <link>s at the plain copies shipped below and drop the hashed ones.
    generateBundle(_, bundle) {
      for (const k of Object.keys(bundle)) if (/^assets\/(manifest|icon-\d+)-/.test(k)) delete bundle[k];
      const html = bundle['index.html'];
      html.source = String(html.source)
        .replace(/href="[^"]*\/assets\/manifest-[^"]+"/, 'href="manifest.webmanifest"')
        .replace(/href="[^"]*\/assets\/icon-192-[^"]+"/g, 'href="icon-192.png"');
    },
    closeBundle() {
      mkdirSync('dist', { recursive: true });
      for (const f of STATIC) cpSync(f, `dist/${f}`, { recursive: true });
    },
  }],
});
