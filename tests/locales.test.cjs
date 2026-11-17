/**
 * Checks the shipped copy, the published manifest, and the input validation
 * around it: every locale carries every key, the manifest agrees with the
 * constants, and only a plausible window list is adopted from the network.
 *
 * Run with the Tehran zone for the local-range assertions:
 *
 *   TZ=Asia/Tehran node tests/locales.test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8');

// The dictionaries.
const copyStart = source.indexOf('const COPY = {');
const copyEnd = source.indexOf('\n    };', copyStart);
assert.ok(copyStart > 0 && copyEnd > copyStart, 'could not slice COPY out of client.js');
const copy = new Function(`${source.slice(copyStart, copyEnd + 6)}\nreturn COPY;`)();

const english = Object.keys(copy.en).sort();
assert.ok(english.length >= 20, `expected the full dictionary, got ${english.length}`);
for (const locale of Object.keys(copy)) {
  assert.deepStrictEqual(Object.keys(copy[locale]).sort(), english, `key mismatch in locale "${locale}"`);
  for (const [key, value] of Object.entries(copy[locale])) {
    assert.strictEqual(typeof value, 'string', `${locale}.${key} must be a string`);
    assert.ok(value.trim() !== '', `${locale}.${key} must not be empty`);
  }
}

// Placeholders agree between locales.
const placeholders = text => (text.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
for (const key of english) {
  assert.strictEqual(placeholders(copy.zh[key]), placeholders(copy.en[key]), `placeholder mismatch in "${key}"`);
}

// The time model around the schedule.
const timeStart = source.indexOf('const PEAK_WINDOWS_UTC_MINUTES');
const timeEnd = source.indexOf('let createPortal');
const api = new Function(`${source.slice(timeStart, timeEnd)}
return { peakRange, normalizeWindows, PEAK_WINDOWS_UTC_MINUTES };`)();

const at = Date.parse('2026-11-17T07:03:56Z');
assert.strictEqual(api.peakRange(at), '04:30–07:30, 09:30–13:30');

// The published manifest must agree with the built-in windows.
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'schedule.json'), 'utf8'));
assert.deepStrictEqual(
  api.normalizeWindows(manifest.windows),
  api.PEAK_WINDOWS_UTC_MINUTES,
  'schedule.json drifted from client.js',
);
assert.ok(manifest.source.includes('api-docs.deepseek.com'), 'schedule.json must name the official source');

// Only a plausible window list is adopted from the network.
assert.deepStrictEqual(api.normalizeWindows([[60, 240]]), [[60, 240]]);
for (const bad of [[], [[0, 0]], [[100, 50]], [[60, 240], [200, 300]], [[1.5, 3]], 'nope', [[-1, 10]], [[60, 2000]]]) {
  assert.strictEqual(api.normalizeWindows(bad), null, `accepted unusable windows ${JSON.stringify(bad)}`);
}

console.log(`copy: ${Object.keys(copy).length} locales × ${english.length} keys agree`);
console.log('peak windows:', api.peakRange(at));
console.log('manifest matches client.js; unsafe window lists rejected');
