#!/usr/bin/env node
/**
 * i18n coverage check — run with `node scripts/check-i18n.mjs`.
 *
 * Catches the two failures that are invisible until a user hits them:
 *   1. A t('some.key') with no entry in en.json. i18next does not throw for
 *      this — it renders the raw key, so the screen shows the literal text
 *      "common.overview" as a heading. That exact bug shipped on the HR admin
 *      and supervisor dashboards and survived every build, every bundle check
 *      and a full design pass, because nothing was looking.
 *   2. A key in en.json with no Hindi translation, which silently falls back
 *      to English for the ~2/3 of employees using the app in Hindi.
 *
 * Exits non-zero on either, so it can go in CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return Object.assign(acc, v && typeof v === 'object' ? flatten(v, key) : { [key]: v });
  }, {});

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.tsx', '.ts'].includes(extname(p))) out.push(p);
  }
  return out;
};

const en = flatten(JSON.parse(readFileSync('i18n/en.json', 'utf8')));
const hi = flatten(JSON.parse(readFileSync('i18n/hi.json', 'utf8')));

// The negative lookbehind matters: without it, `select('id')` and
// `insert('...')` match too, because both end in "t(".
const T_CALL = /(?<![A-Za-z])t\(\s*['"]([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"]/g;
const TITLE_PROP = /title="([a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+)"/g;

const used = new Set();
for (const dir of ['app', 'components', 'hooks']) {
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(T_CALL)) used.add(m[1]);
    for (const m of src.matchAll(TITLE_PROP)) used.add(m[1]);
  }
}

const missingEn = [...used].filter(k => !(k in en)).sort();
const missingHi = Object.keys(en).filter(k => !(k in hi)).sort();
const orphanHi = Object.keys(hi).filter(k => !(k in en)).sort();

console.log(`referenced in code : ${used.size}`);
console.log(`defined in en.json : ${Object.keys(en).length}`);

let failed = false;
if (missingEn.length) {
  failed = true;
  console.error(`\n✗ ${missingEn.length} key(s) used in code but missing from en.json`);
  console.error('  These render as the raw key on screen:');
  missingEn.forEach(k => console.error('   ', k));
}
if (missingHi.length) {
  failed = true;
  console.error(`\n✗ ${missingHi.length} key(s) in en.json with no Hindi translation`);
  missingHi.forEach(k => console.error('   ', k));
}
if (orphanHi.length) {
  console.warn(`\n! ${orphanHi.length} key(s) in hi.json with no English counterpart (dead weight, not fatal)`);
  orphanHi.forEach(k => console.warn('   ', k));
}

if (failed) process.exit(1);
console.log('\n✓ every referenced key exists, and Hindi covers all of English.');
