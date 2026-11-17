/**
 * Exercises the real time model inside client.js without a browser: the
 * functions are sliced out of the source text, so these assertions cannot
 * drift from the shipped code.
 *
 * The schedule under test is DeepSeek's published one: peak is Monday to
 * Friday, 01:00–04:00 and 06:00–10:00 UTC, excluding Chinese public holidays.
 * Run with the Tehran zone for the local-range assertions:
 *
 *   TZ=Asia/Tehran node tests/time-model.test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8');
const start = source.indexOf('const PEAK_WINDOWS_UTC_MINUTES');
const end = source.indexOf('let createPortal');
assert.ok(start > 0 && end > start, 'could not slice the time block out of client.js');

const api = new Function(`${source.slice(start, end)}
return { isPeakAt, isHoliday, isRestDay, readState, nextTransition, dayBoundaries, durationParts, peakRange, clockTime, ribbonRuns, dayProgress };`)();

const t = key => ({ 'unit.d': 'd', 'unit.h': 'h', 'unit.m': 'm', 'unit.s': 's' }[key]);
const at = iso => Date.parse(iso);

/** One expectation about a probe instant. */
function probe(iso, mode, remainingMinutes) {
  const now = at(iso);
  const state = api.readState(now);
  assert.strictEqual(state.mode, mode, `${iso}: expected ${mode}, got ${state.mode}`);
  const minutes = Math.round(state.remaining / 60000);
  assert.strictEqual(minutes, remainingMinutes, `${iso}: expected ${remainingMinutes}m remaining, got ${minutes}m`);
  return state;
}

// Tuesday 02:00 UTC — inside the first window.
probe('2026-11-17T02:00:00Z', 'peak', 120);
// Tuesday 03:50 UTC — ten minutes left in the first window.
probe('2026-11-17T03:50:00Z', 'peak', 10);
// Tuesday 04:00 UTC — the window closes; the next one starts at 06:00.
probe('2026-11-17T04:00:00Z', 'off', 120);
// Tuesday 05:29 UTC — 31 minutes out, still green.
probe('2026-11-17T05:29:00Z', 'off', 31);
// Tuesday 05:40 UTC — 20 minutes out, amber.
probe('2026-11-17T05:40:00Z', 'soon', 20);
// Tuesday 06:00 UTC — second window opens.
probe('2026-11-17T06:00:00Z', 'peak', 240);
// Tuesday 09:59 UTC — last minute of the second window.
probe('2026-11-17T09:59:00Z', 'peak', 1);
// Friday 09:00 UTC — peak, then the weekend is off-peak.
probe('2026-11-20T09:00:00Z', 'peak', 60);
// Friday 10:00 UTC — the next peak is Monday 01:00 UTC (63 hours).
probe('2026-11-20T10:00:00Z', 'off', 63 * 60);
// Saturday 02:00 UTC — whole weekend off-peak, next peak Monday 01:00.
probe('2026-11-14T02:00:00Z', 'off', 47 * 60);
// Thursday 2026-10-01 02:00 UTC — National Day holiday, off-peak all day.
probe('2026-10-01T02:00:00Z', 'off', 167 * 60);
// Thursday 2026-10-01 09:30 UTC — still the holiday, no window applies.
probe('2026-10-01T09:30:00Z', 'off', 159.5 * 60);
// Thursday 2026-10-08 02:00 UTC — the holiday is over, peak again.
probe('2026-10-08T02:00:00Z', 'peak', 120);
// Tuesday 2026-02-24 02:00 UTC — day after the Spring Festival, peak again.
probe('2026-02-24T02:00:00Z', 'peak', 120);
// Sunday 23:50 UTC — 70 minutes to Monday's peak, not amber yet.
probe('2026-11-15T23:50:00Z', 'off', 70);

// Rest days: weekend, holiday, and a normal weekday.
assert.strictEqual(api.isRestDay(at('2026-11-14T02:00:00Z')), true, 'Saturday is a rest day');
assert.strictEqual(api.isRestDay(at('2026-10-01T02:00:00Z')), true, 'National Day is a rest day');
assert.strictEqual(api.isRestDay(at('2026-11-17T02:00:00Z')), false, 'a normal Tuesday is not');
assert.strictEqual(api.isHoliday(at('2026-10-08T02:00:00Z')), false, 'the day after National Day is not');

// The ribbon covers a whole local day: a weekday shows two peak blocks, a
// weekend shows none.
const weekdayRuns = api.ribbonRuns(at('2026-11-16T08:00:00Z'));
assert.strictEqual(weekdayRuns.reduce((sum, run) => sum + run.count, 0), 96);
assert.deepStrictEqual(weekdayRuns, [
  { key: 'off', count: 18 },
  { key: 'peak', count: 12 },
  { key: 'off', count: 8 },
  { key: 'peak', count: 16 },
  { key: 'off', count: 42 },
], `unexpected weekday ribbon: ${JSON.stringify(weekdayRuns)}`);

const weekendRuns = api.ribbonRuns(at('2026-11-14T08:00:00Z'));
assert.deepStrictEqual(weekendRuns, [{ key: 'off', count: 96 }], 'a Saturday is all off-peak');

// Local readout for Tehran (UTC+03:30).
assert.strictEqual(api.peakRange(at('2026-11-17T07:00:00Z')), '04:30–07:30, 09:30–13:30');

// Hover targets: only the four points where peak flips inside a weekday, and
// none at all on a rest day.
const weekdayBounds = api.dayBoundaries(at('2026-11-16T08:00:00Z'));
assert.deepStrictEqual(
  weekdayBounds.map(instant => api.clockTime(instant)),
  ['04:30', '07:30', '09:30', '13:30'],
  `unexpected boundaries: ${JSON.stringify(weekdayBounds)}`,
);
assert.deepStrictEqual(api.dayBoundaries(at('2026-11-14T08:00:00Z')), [], 'a Saturday has no boundaries');

// Day progress is the local wall clock.
const progress = api.dayProgress(at('2026-11-17T07:03:56Z'));
assert.ok(Math.abs(progress - ((10 * 60 + 33.93) / 1440) * 100) < 0.1, `progress ${progress}`);

// Countdown formatting picks two units.
assert.deepStrictEqual(api.durationParts(3 * 3600e3 + 12 * 60e3, t), ['3h', '12m']);
assert.deepStrictEqual(api.durationParts(26 * 3600e3, t), ['1d', '2h']);
assert.deepStrictEqual(api.durationParts(12 * 60e3 + 5e3, t), ['12m', '5s']);

console.log('time model: all assertions passed');
console.log('weekday ribbon:', JSON.stringify(weekdayRuns));
console.log('peak windows (Tehran):', api.peakRange(at('2026-11-17T07:00:00Z')));
