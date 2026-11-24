// Builds the frontend assets into public/ (npm run build). Works on Windows, macOS and Linux.
// The output is committed, so `npm start` works on a fresh clone without running this.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const fromPackage = (file) => path.join(ROOT, 'node_modules', file);
const inPublic = (file) => path.join(ROOT, 'public', file);

const COPIES = [
  ['basecoat-css/dist/js/all.min.js', 'vendor/basecoat.min.js'],
  ['basecoat-css/dist/js/chart.min.js', 'vendor/basecoat-chart.min.js'],
  ['lucide-static/sprite.svg', 'vendor/lucide.svg'],
  ['chart.js/dist/chart.umd.min.js', 'vendor/chart.umd.min.js'],
  [
    '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
    'css/files/geist-latin-wght-normal.woff2',
  ],
  [
    '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
    'css/files/geist-mono-latin-wght-normal.woff2',
  ],
];

function copyAssets() {
  for (const [from, to] of COPIES) {
    fs.mkdirSync(path.dirname(inPublic(to)), { recursive: true });
    fs.copyFileSync(fromPackage(from), inPublic(to));
  }
}

function buildCss({ watch = false } = {}) {
  const cli = fromPackage('@tailwindcss/cli/dist/index.mjs');
  const args = [cli, '-i', 'src/styles/app.css', '-o', 'public/css/app.css'];
  execFileSync(process.execPath, [...args, ...(watch ? ['--watch'] : ['--minify'])], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

// npm run build = everything; npm run build:css = only the stylesheet; npm run watch:css
const mode = process.argv[2] ?? 'all';
if (mode === 'all') copyAssets();
buildCss({ watch: mode === 'watch' });
