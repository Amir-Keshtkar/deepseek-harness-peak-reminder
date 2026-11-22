/**
 * Guards the right-to-left stylesheet: every surface the plugin promises to
 * mirror keeps its selector, and the code-bearing surfaces stay left to right.
 *
 * The stylesheet is plain CSS inside client.js, so it is sliced out and read
 * as text; nothing here needs a browser.
 *
 *   node tests/rtl.test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8');

const start = source.indexOf('const RTL_CSS = `');
const end = source.indexOf('\n`;', start);
assert.ok(start > 0 && end > start, 'could not slice RTL_CSS out of client.js');
const css = source.slice(start, end);

/** The declaration block that follows a selector list. */
const blockFor = (selector) => {
  const at = css.indexOf(selector);
  assert.ok(at !== -1, `RTL_CSS lost the "${selector}" selector`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

// Every surface the README names.
for (const selector of [
  '[data-chat-flow-kind="assistant-step"] [class*="_markdown"]',
  '[data-message-bubble]',
  '[data-row-key^="session:"] [class*="_title"]',
  '[data-question-key]',
  '[data-document-markdown]',
  '[data-approval-key]',
]) {
  assert.match(blockFor(selector), /direction:\s*rtl/, `${selector} must read right to left`);
}

// The approval prompt's prose follows the card; its tool detail and code do not.
assert.match(blockFor('[data-approval-key] [class*="_heading"]'), /direction:\s*rtl/);
assert.match(blockFor('[data-approval-key] [class*="_headline"]'), /text-align:\s*start/);
assert.match(blockFor('[data-approval-key] [class*="_description"]'), /text-align:\s*start/);
assert.match(blockFor('[data-approval-key] [data-approval-scroll]'), /direction:\s*ltr/);
assert.match(blockFor('[data-approval-key] [class*="_command"]'), /direction:\s*ltr/);
assert.match(blockFor('[data-approval-key] [class*="_command"]'), /text-align:\s*left/);

// Code and formulas stay legible whichever prose surface holds them.
assert.match(blockFor('[data-chat-flow-kind] [data-code-wrap]'), /direction:\s*ltr/);
assert.match(blockFor('[data-document-markdown] pre'), /direction:\s*ltr/);

// The stylesheet stays plain: no library, no !important fights with the host.
assert.ok(!css.includes('!important'), 'RTL_CSS must not use !important');
assert.ok(!/@import|url\(/.test(css), 'RTL_CSS must not pull in remote styles');

// It is CSS, not a script: rules balance and nothing interpolates.
assert.ok(!css.includes('${'), 'RTL_CSS must not interpolate');
let depth = 0;
for (const character of css) {
  if (character === '{') depth += 1;
  if (character === '}') depth -= 1;
  assert.ok(depth >= 0, 'RTL_CSS closes a block it never opened');
}
assert.strictEqual(depth, 0, 'RTL_CSS blocks must balance');

console.log('rtl: prose surfaces mirror, code surfaces stay left to right');
