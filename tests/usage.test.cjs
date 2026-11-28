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

// A storage stand-in seeded with the 1.9.0 credit shape, which must migrate to
// the base/last pair the ring now compares against.
const stored = new Map([['dsh.peak-reminder.credit', JSON.stringify({ USD: 20 })]]);
global.localStorage = {
  getItem: key => (stored.has(key) ? stored.get(key) : null),
  setItem: (key, value) => { stored.set(key, String(value)); },
};

const api = new Function(`${source.slice(start, end)}
return {
  priceFamily, estimateCost, formatTokens, formatCost, formatDuration,
  currentSessionId, formatMoney, balanceText, sumWallets, createStore, PRICE_TABLE,
  readSpendBook, spendTotal, mergeSpend, resetSpend, sessionSpendCosts, creditShare,
  readCreditMarks,
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

// The lifetime spend book: every Session's highest observed cost, minus the
// baseline in force when the reader last reset the counter.
const empty = { sessions: {} };
assert.strictEqual(api.spendTotal(empty), 0);
const first = api.mergeSpend(empty, { a: 0.5, b: 0.25 });
assert.strictEqual(first.changed, true);
assert.strictEqual(api.spendTotal(first.book), 0.75);
assert.deepStrictEqual(first.book.sessions.a, { base: 0, seen: 0.5 });
const same = api.mergeSpend(first.book, { a: 0.5 });
assert.strictEqual(same.changed, false, 'an unchanged cost must not write');
assert.strictEqual(api.spendTotal(first.book), 0.75);
const lower = api.mergeSpend(first.book, { a: 0.4 });
assert.strictEqual(lower.changed, false, 'a re-read that comes back lower must not shrink the total');
const zero = api.mergeSpend(first.book, { c: 0 });
assert.strictEqual(zero.changed, false, 'a Session with no usage is not bookkeeping');

const reset = api.resetSpend(first.book, { a: 0.5, b: 0.25 });
assert.strictEqual(api.spendTotal(reset), 0, 'a reset starts the counter again at zero');
const afterReset = api.mergeSpend(reset, { a: 0.6 });
assert.strictEqual(api.spendTotal(afterReset.book), 0.1, 'only spend after the reset counts');
const unseen = api.resetSpend(empty, { d: 2 });
assert.strictEqual(api.spendTotal(unseen), 0);
assert.strictEqual(api.spendTotal(api.mergeSpend(unseen, { d: 3.5 }).book), 1.5,
  'a Session first met at reset time keeps its baseline');

// One cost per Session, charged from its own projection at the rate in force.
const spendState = {
  byId: { s1: { model: 'deepseek-flash' }, s2: { model: 'deepseek-v4-pro' } },
  projectionsBySession: {
    s1: { values: { tokenUsage: { uncachedInputTokens: 1e6 } } },
    s2: { values: { tokenUsage: { outputTokens: 1e6 } } },
    s3: { values: {} },
  },
};
assert.deepStrictEqual(api.sessionSpendCosts(spendState, false), { s1: 0.15, s2: 1.98 });
assert.deepStrictEqual(api.sessionSpendCosts(undefined, false), {});

// The ring compares the current credit with the amount in force after the most
// recent top-up. A rise re-baselines even below an older peak; a fall is spend.
// The 1.9.0 high-water number had different semantics and is deliberately
// dropped, so the next read starts a clean baseline.
assert.deepStrictEqual(api.readCreditMarks(), {}, 'the old high-water shape is not reused');
stored.set('dsh.peak-reminder.credit', JSON.stringify({ USD: { base: 12, last: 9 }, CNY: 'nope', EUR: { base: 1, last: 1 } }));
assert.deepStrictEqual(api.readCreditMarks(), {
  USD: { base: 12, last: 9 },
  EUR: { base: 1, last: 1 },
}, 'only well-formed base/last pairs load');
const mark0 = api.creditShare([{ currency: 'USD', balance: '20' }], {});
assert.strictEqual(mark0.share, 0, 'the first read is the baseline');
assert.deepStrictEqual(mark0.marks, { USD: { base: 20, last: 20 } });
assert.strictEqual(mark0.changed, true);
const mark1 = api.creditShare([{ currency: 'USD', balance: '18' }], mark0.marks);
assert.strictEqual(mark1.share, 0.1);
assert.deepStrictEqual(mark1.marks, { USD: { base: 20, last: 18 } });
const mark2 = api.creditShare([{ currency: 'USD', balance: '5' }], mark1.marks);
assert.strictEqual(mark2.share, 0.75);
assert.strictEqual(mark2.changed, true, 'a new balance is worth storing');
const unchanged = api.creditShare([{ currency: 'USD', balance: '5' }], mark2.marks);
assert.strictEqual(unchanged.changed, false, 'an identical read writes nothing');
const toppedUp = api.creditShare([{ currency: 'USD', balance: '30' }], mark2.marks);
assert.strictEqual(toppedUp.share, 0);
assert.deepStrictEqual(toppedUp.marks, { USD: { base: 30, last: 30 } });
// The case the high-water version got wrong: top up to an amount still below
// the old peak. $5 -> $8 after a $20 peak must read as a fresh baseline, not
// as the 60% the old ceiling would have shown.
const belowPeak = api.creditShare([{ currency: 'USD', balance: '8' }], mark2.marks);
assert.strictEqual(belowPeak.share, 0, 'any top-up re-baselines, even below the old peak');
assert.deepStrictEqual(belowPeak.marks, { USD: { base: 8, last: 8 } });
const mixed = api.creditShare([
  { currency: 'USD', balance: '5' },
  { currency: 'CNY', balance: '50' },
], { USD: { base: 10, last: 10 }, CNY: { base: 50, last: 50 } });
assert.strictEqual(mixed.share, 5 / 60);
assert.strictEqual(api.creditShare([], {}).share, 0, 'no credit means no ratio');

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
