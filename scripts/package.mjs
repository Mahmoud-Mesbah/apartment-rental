// ينسخ ناتج البناء dist/index.html إلى apps-script/Index.html ويتحقق منه
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'dist/index.html');
const out = resolve(root, 'apps-script/Index.html');

if (!existsSync(src)) {
  console.error('dist/index.html غير موجود. شغّل npm run build أولًا.');
  process.exit(1);
}
const html = readFileSync(src, 'utf8');
if (/src=["']\/?assets\//.test(html) || /href=["']\/?assets\//.test(html)) {
  console.error('الملف يحتوي على مراجع خارجية إلى assets/، لم يتم تضمينها بالكامل.');
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`تم إنشاء apps-script/Index.html (${mb} MB)`);
if (Buffer.byteLength(html) > 12 * 1024 * 1024) console.warn('تحذير: الحجم كبير جدًا لـ Apps Script.');
