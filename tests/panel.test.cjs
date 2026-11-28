/**
 * Render coverage for the panel surfaces without a browser: the balance band
 * (which gains a lifetime-spend row when credit cannot be read) and the usage
 * ring (whose arc is the share of credit spent).
 *
 *   node tests/panel.test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8');
const start = source.indexOf('const PRICE_TABLE = {');
const end = source.indexOf('function UsageEntry');
assert.ok(start > 0 && end > start, 'could not slice the panel helpers out of client.js');

const h = (type, props, ...children) => ({ type, props: props ?? {}, children });
const api = new Function('h', `${source.slice(start, end)}\nreturn { BalanceBand, UsageRing };`)(h);

const text = node => {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(text).join('');
  return (node.children ?? []).map(text).join('');
};
const t = key => key;

// Credit is readable: one line, no lifetime row.
const ready = api.BalanceBand({
  t,
  balance: {
    status: 'ready',
    value: [{ balance: '10.00', currency: 'USD' }],
    bonusWallets: [{ balance: '2.34', currency: 'USD' }],
  },
  spent: 4.5,
  onResetSpent: () => {},
});
assert.strictEqual(ready.props['data-peakr-balance'], 'ready');
assert.strictEqual(ready.children.filter(child => child !== null).length, 2,
  'a ready balance keeps the band to one line');
assert.strictEqual(ready.children[2], null, 'no lifetime row while credit is readable');
assert.strictEqual(text(ready.children[1]), '$12.34');

// An API-key reader (or a refused read) gets the lifetime figure plus a reset.
let resets = 0;
const unread = api.BalanceBand({
  t,
  balance: { status: 'failed' },
  spent: 1.2345,
  onResetSpent: () => { resets += 1; },
});
assert.strictEqual(unread.props['data-peakr-balance'], 'failed');
assert.strictEqual(text(unread.children[1]), 'balance.unavailable');
assert.strictEqual(text(unread.children[2]), 'spend.label');
assert.strictEqual(unread.children[3].props.className, 'peakr-spent-value');
assert.strictEqual(text(unread.children[3]).replace('$1.23', ''), '', 'the lifetime figure is the cost');
const resetButton = unread.children[3].children[1];
assert.strictEqual(resetButton.props['aria-label'], 'spend.reset.aria');
resetButton.props.onClick();
assert.strictEqual(resets, 1, 'the reset button calls its handler');

// A signed-out page shows the lifetime row too.
const signedOut = api.BalanceBand({
  t, balance: { status: 'signedOut' }, spent: 0, onResetSpent: () => {},
});
assert.strictEqual(text(signedOut.children[2]), 'spend.label');
assert.strictEqual(text(signedOut.children[3]).replace('$0', ''), '');

// An in-flight read is not "Unavailable": it is a placeholder and a spinner,
// with no lifetime number flashing before the account answers. This is the
// state that used to show a stale figure for a moment on every panel opening.
for (const balance of [undefined, { status: 'loading' }]) {
  const pending = api.BalanceBand({ t, balance, spent: 7.23, onResetSpent: () => {} });
  assert.strictEqual(pending.props['data-peakr-balance'], 'loading');
  assert.strictEqual(text(pending.children[1]), '…', 'the figure is a placeholder, not a number');
  assert.ok(pending.children[1].props.className.includes('is-loading'), 'the placeholder animates');
  assert.strictEqual(pending.children[2], null, 'no lifetime row while the read is in flight');
  assert.strictEqual(pending.children[3], null);
  const spinner = pending.children[0].children.at(-1);
  assert.strictEqual(spinner.props.className, 'peakr-balance-spinner', 'the label carries a spinner');
  assert.strictEqual(spinner.props['aria-hidden'], 'true');
}

const loaded = api.BalanceBand({ t, balance: { status: 'loading' }, spent: 0, onResetSpent: () => {} });
assert.strictEqual(text(loaded.children[1]), '…');

// The ring: an empty track without credit, one arc once there is a ratio.
const empty = api.UsageRing({ share: null });
assert.strictEqual(empty.children.filter(child => child !== null).length, 1,
  'no credit means only the track');
assert.strictEqual(empty.children[0].props.opacity, 0.22);
const half = api.UsageRing({ share: 0.5, label: 'usage.ring.aria' });
assert.strictEqual(half.children.length, 2);
assert.strictEqual(half.props.role, 'img');
assert.strictEqual(half.props['aria-label'], 'usage.ring.aria');
const circumference = 2 * Math.PI * 8;
assert.ok(Math.abs(half.children[1].props.strokeDashoffset - circumference / 2) < 1e-9,
  'half the credit spent leaves half the circumference');
const full = api.UsageRing({ share: 1 });
assert.strictEqual(full.children[1].props.strokeDashoffset, 0);
const clamped = api.UsageRing({ share: 4 });
assert.strictEqual(clamped.children[1].props.strokeDashoffset, 0, 'an over-drawn ratio stays full');

console.log('panel surfaces: band states and the usage ring render');
console.log('lifetime row:', text(unread.children[2]), text(unread.children[3]));
