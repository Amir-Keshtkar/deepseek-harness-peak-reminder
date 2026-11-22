/**
 * Unit coverage for the usage helpers in client.js: the price table, the cost
 * estimate, the compact formatters, and the tiny observable store.
 *
 *   node tests/usage.test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8');
const start = source.indexOf('const PRICE_TABLE = {');
const end = source.indexOf('function UsageRow');
assert.ok(start > 0 && end > start, 'could not slice the usage helpers out of client.js');

const api = new Function(`${source.slice(start, end)}
return {
  priceFamily, estimateCost, formatTokens, formatCost, formatDuration,
  currentSessionId, formatMoney, balanceText, sumWallets, createStore, PRICE_TABLE,
};`)();

// Model → price family.
assert.strictEqual(api.priceFamily('deepseek-v4-pro'), 'pro');
assert.strictEqual(api.priceFamily('deepseek-flash'), 'flash');
assert.strictEqual(api.priceFamily(undefined), 'flash');

// One million tokens per bucket, at both rates.
const million = bucket => ({ [`${bucket}`]: 1e6 });
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, got ${actual}`);

close(api.estimateCost({ uncachedInputTokens: 1e6 }, 'deepseek-flash', false), 0.15, 'flash input off-peak');
close(api.estimateCost({ uncachedInputTokens: 1e6 }, 'deepseek-flash', true), 0.3, 'flash input peak');
close(api.estimateCost({ cacheReadTokens: 1e6 }, 'deepseek-flash', false), 0.003, 'flash cached off-peak');
close(api.estimateCost({ outputTokens: 1e6 }, 'deepseek-flash', false), 0.6, 'flash output off-peak');
close(
  api.estimateCost({ uncachedInputTokens: 1e6, cacheReadTokens: 1e6, outputTokens: 1e6 }, 'deepseek-v4-pro', true),
  1.32 + 0.044 + 3.96,
  'pro peak all buckets',
);
assert.strictEqual(api.estimateCost({}, 'deepseek-flash', false), 0, 'empty usage costs nothing');
assert.strictEqual(api.estimateCost({ uncachedInputTokens: 1e6 }, 'deepseek-flash', true),
  2 * api.estimateCost({ uncachedInputTokens: 1e6 }, 'deepseek-flash', false), 'peak is double off-peak');

// Formatters.
assert.strictEqual(api.formatTokens(0), '0');
assert.strictEqual(api.formatTokens(999), '999');
assert.strictEqual(api.formatTokens(1500), '1.5k');
assert.strictEqual(api.formatTokens(1.5e6), '1.50M');
assert.strictEqual(api.formatCost(0), '$0');
assert.strictEqual(api.formatCost(0.0031), '$0.003');
assert.strictEqual(api.formatCost(1.5), '$1.50');
assert.strictEqual(api.formatDuration(0), '0s');
assert.strictEqual(api.formatDuration(95000), '1m 35s');
assert.strictEqual(api.formatDuration(3700000), '1h 1m');

// The current session is the one the main view retains, exactly as the Session
// controller publishes it.
assert.strictEqual(api.currentSessionId({
  byId: {
    a: { id: 'a', retainedBy: { mainView: 0 } },
    b: { id: 'b', retainedBy: { mainView: 2 } },
    c: { id: 'c' },
  },
}), 'b');
assert.strictEqual(api.currentSessionId({ byId: { a: { id: 'a', retainedBy: { mainView: 0 } } } }), undefined);
assert.strictEqual(api.currentSessionId(undefined), undefined);
assert.strictEqual(api.currentSessionId({}), undefined);

// Money and the balance band.
assert.strictEqual(api.formatMoney('12.4', 'USD'), '$12.40');
assert.strictEqual(api.formatMoney('0', 'CNY'), '¥0.00');
assert.strictEqual(api.formatMoney('0.003', 'USD'), '<$0.01');
assert.strictEqual(api.formatMoney('1234.5', 'USD'), '$1,234.50');
assert.strictEqual(api.balanceText([{ balance: '12.4', currency: 'USD' }]), '$12.40');
assert.strictEqual(api.balanceText([{ balance: '0', currency: 'CNY' }, { balance: '3.2', currency: 'CNY' }]), '¥0.00 · ¥3.20');
assert.strictEqual(api.balanceText([]), null);
assert.strictEqual(api.balanceText(undefined), null);
assert.strictEqual(api.balanceText([{}]), null);

// The headline total adds the topped-up and the granted wallets per currency;
// the source rows keep their server precision, the total is rounded to cents.
assert.deepStrictEqual(api.sumWallets([{ balance: '10', currency: 'USD' }], [{ balance: '2.34', currency: 'USD' }]),
  [{ currency: 'USD', balance: '12.34' }]);
assert.deepStrictEqual(api.sumWallets([{ balance: '5', currency: 'CNY' }], undefined),
  [{ currency: 'CNY', balance: '5' }]);
assert.deepStrictEqual(api.sumWallets([], []), []);
assert.deepStrictEqual(api.sumWallets([{ balance: '0', currency: 'CNY' }, { balance: '3.2', currency: 'CNY' }], []),
  [{ currency: 'CNY', balance: '3.2' }]);
assert.deepStrictEqual(
  api.sumWallets([{ balance: '4', currency: 'USD' }], [{ balance: '1.5', currency: 'CNY' }, { balance: '2', currency: 'CNY' }]),
  [{ currency: 'USD', balance: '4' }, { currency: 'CNY', balance: '3.5' }],
  'currencies are summed independently');
assert.strictEqual(api.balanceText(api.sumWallets([{ balance: '10', currency: 'USD' }], [{ balance: '2.34', currency: 'USD' }])),
  '$12.34');
assert.strictEqual(api.balanceText(api.sumWallets([], [])), null, 'no wallets means no headline');

// The store publishes only real changes.
const store = api.createStore(1);
let notifications = 0;
const off = store.subscribe(() => { notifications += 1; });
store.set(1);
assert.strictEqual(notifications, 0, 'an unchanged value must not notify');
store.set(2);
assert.strictEqual(notifications, 1);
assert.strictEqual(store.getSnapshot(), 2);
off();
store.set(3);
assert.strictEqual(notifications, 1, 'unsubscribed listeners must not fire');

// The footer entry hands the injected balance hook and its refresh down to the
// button that renders the band. Dropping them left the band on its placeholder
// forever, because the button saw no balance source at all.
const entryStart = source.indexOf('function UsageEntry');
const entryEnd = source.indexOf('function UsageButton');
assert.ok(entryStart > 0 && entryEnd > entryStart, 'could not slice UsageEntry out of client.js');
const element = (type, props) => ({ type, props });
const Button = function UsageButton() {};
const UsageEntry = new Function('h', 'UsageButton', `${source.slice(entryStart, entryEnd)}\nreturn UsageEntry;`)(element, Button);
const useBalance = value => value;
const refreshBalance = () => {};
const entry = UsageEntry({ t: key => key, wide: true, useSessions: () => undefined, useBalance, refreshBalance });
assert.notStrictEqual(entry, null, 'a sidebar with a session source renders the entry');
assert.strictEqual(entry.type, Button, 'the entry renders the usage button');
assert.strictEqual(entry.props.useBalance, useBalance, 'the balance hook reaches the button');
assert.strictEqual(entry.props.refreshBalance, refreshBalance, 'the refresh reaches the button');
assert.strictEqual(entry.props.t('usage.label'), 'usage.label', 'copy still reaches the button');
assert.strictEqual(UsageEntry({ t: key => key, wide: true }), null, 'no session source means no entry');

console.log('usage helpers: all assertions passed');
console.log('price table:', JSON.stringify(api.PRICE_TABLE.flash.off));
