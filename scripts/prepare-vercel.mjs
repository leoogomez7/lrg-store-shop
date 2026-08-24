import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist', 'client');
const assetsDir = path.join(distDir, 'assets');

mkdirSync(distDir, { recursive: true });

const assetFiles = readdirSync(assetsDir);

const jsFiles = assetFiles.filter((file) => file.startsWith('index-') && file.endsWith('.js'));
const cssFiles = assetFiles.filter((file) => file.startsWith('styles-') && file.endsWith('.css'));

if (jsFiles.length === 0) {
  throw new Error('No se encontró el bundle principal de JS en dist/client/assets');
}

const newestFile = (files) =>
  files
    .map((file) => ({ file, mtime: statSync(path.join(assetsDir, file)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.file;

const jsEntry = newestFile(jsFiles);
const cssEntry = newestFile(cssFiles);

for (const file of [...jsFiles, ...cssFiles]) {
  if (file !== jsEntry && file !== cssEntry) {
    unlinkSync(path.join(assetsDir, file));
  }
}

const { default: server } = await import('../dist/server/server.js');
const response = await server.fetch(new Request('https://lrg-store-shop.local/'), {}, {});

if (!response.ok) {
  throw new Error(`No se pudo prerenderizar la pagina principal: ${response.status}`);
}

const html = await response.text();
writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
console.log(`index.html generado en ${path.join(distDir, 'index.html')}`);
