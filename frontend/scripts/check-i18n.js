#!/usr/bin/env node
// i18n parity gate — run with `node scripts/check-i18n.js` (frontend cwd).
//
// Enforces two things, failing the process (exit 1) on either:
//   1. Every translation key referenced in the app source (`t('…')`,
//      `i18nKey="…"`) exists in en.js.
//   2. Every locale file has exactly the same key set as en.js — no missing
//      keys (would render the raw key text to users) and no orphans.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALE_DIR = path.join(ROOT, 'i18n', 'translations');

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function loadLocale(file) {
  const src = fs.readFileSync(path.join(LOCALE_DIR, file), 'utf8');
  const withoutExport = src.replace(/export\s+default\s+\w+\s*;\s*$/, '');
  const eq = withoutExport.indexOf('=');
  const body = withoutExport.slice(eq + 1).trim().replace(/;$/, '');
  // eslint-disable-next-line no-eval
  return flatten(eval(`(${body})`));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'i18n'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(p);
  }
  return files;
}

const locales = fs.readdirSync(LOCALE_DIR).filter((f) => f.endsWith('.js')).sort();
if (!locales.includes('en.js')) {
  console.error('i18n gate: en.js missing');
  process.exit(1);
}

const enKeys = new Set(Object.keys(loadLocale('en.js')));
const errors = [];

// (1) every t('…') used in app code exists in en.js
const tKey = /\bt\(\s*['"`]([a-zA-Z0-9_.-]+)['"`]/g;
const i18nKeyAttr = /i18nKey=["']([a-zA-Z0-9_.-]+)["']/g;
const used = new Map();
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const re of [tKey, i18nKeyAttr]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      if (!used.has(m[1])) used.set(m[1], path.relative(ROOT, file));
    }
  }
}
for (const [key, file] of used) {
  if (!enKeys.has(key)) errors.push(`used-but-missing in en.js: '${key}' (${file})`);
}

// (2) locale parity against en.js
for (const locale of locales) {
  const keys = new Set(Object.keys(loadLocale(locale)));
  const missing = [...enKeys].filter((k) => !keys.has(k));
  const orphans = [...keys].filter((k) => !enKeys.has(k));
  if (missing.length) errors.push(`${locale}: missing ${missing.length} keys → ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`);
  if (orphans.length) errors.push(`${locale}: ${orphans.length} orphan keys not in en.js → ${orphans.slice(0, 8).join(', ')}`);
}

console.log(`i18n gate: ${locales.length} locales, ${enKeys.size} keys in en.js, ${used.size} keys referenced in code`);

if (errors.length) {
  console.error(`\n${errors.length} violation(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('✓ parity OK — every locale matches en.js and every referenced key exists');
