// Copies the pdf.js worker into /public so PDF slides can load it from the site itself (runs before every build).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve('pdfjs-dist/package.json')), 'build', 'pdf.worker.min.mjs');
mkdirSync('public/vendor', { recursive: true });
copyFileSync(src, 'public/vendor/pdf.worker.min.mjs');
