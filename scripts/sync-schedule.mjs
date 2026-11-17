#!/usr/bin/env node
/**
 * Read DeepSeek's peak hours from the official pricing page and keep
 * `PEAK_WINDOWS_UTC_MINUTES` in client.js in step with it.
 *
 * The docs site publishes no pricing API, so this reads the page's own "copy
 * markdown" export — the exact sentence that defines the schedule. It refuses
 * to write anything it could not parse, and it reports a change in the rule
 * itself (weekdays, holiday exclusion) instead of silently accepting it.
 *
 * The same module backs the plugin's Host half, which runs it on activation and
 * again every twelve hours, so a local install follows the published schedule
 * without anyone running a command.
 *
 * CLI: node scripts/sync-schedule.mjs [--check]
 *   --check  report drift without writing; exit 1 when client.js is stale.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Official pages, English first, then the Chinese original. */
const SOURCES = [
  'https://api-docs.deepseek.com/quick_start/pricing.md',
  'https://api-docs.deepseek.com/zh-cn/quick_start/pricing.md',
];

/** The file holding the schedule constants. */
const CLIENT = fileURLToPath(new URL('../client.js', import.meta.url));

/** A window as it appears in the sentence: `01:00 - 04:00`. */
const RANGE = () => /(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/g;

/**
 * Fetch the first source that answers.
 * @param {number} timeoutMs - per-request budget.
 * @returns {Promise<{url: string, text: string}>} the page and where it came from.
 */
async function readSource(timeoutMs) {
  const failures = [];
  for (const url of SOURCES) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'dsh-peak-reminder/1.0 (schedule sync)' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { url, text: await response.text() };
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(`no source answered (${failures.join('; ')})`);
}

/**
 * Find the sentence that defines the schedule and read it.
 * @param {string} text - the page's markdown.
 * @returns {{sentence: string, windows: Array<[number, number]>, weekdayRule: boolean, holidayRule: boolean}}
 */
function parseSchedule(text) {
  const flat = text.replace(/[ \t]+/g, ' ');
  const sentence = /Peak hours are [^.]*\./i.exec(flat)?.[0]
    ?? /高峰时段[^。]*。/.exec(flat)?.[0];
  if (sentence === undefined) throw new Error('the page no longer states a peak-hours sentence');

  const inBeijingTime = /北京时间/.test(sentence);
  const windows = [];
  for (const match of sentence.matchAll(RANGE())) {
    const [, fromHour, fromMinute, toHour, toMinute] = match;
    let start = Number(fromHour) * 60 + Number(fromMinute);
    let end = Number(toHour) * 60 + Number(toMinute);
    if (inBeijingTime) {
      // The sentence states Beijing time; the plugin stores UTC minutes.
      start = (start - 8 * 60 + 1440) % 1440;
      end = (end - 8 * 60 + 1440) % 1440;
    }
    if (!(start < end)) throw new Error(`unusable peak window in "${sentence}"`);
    windows.push([start, end]);
  }
  if (windows.length === 0) throw new Error(`no peak windows in "${sentence}"`);
  windows.sort((a, b) => a[0] - b[0]);

  return {
    sentence: sentence.trim(),
    windows,
    weekdayRule: /Monday through Friday|周一至周五|週一至週五/.test(sentence),
    holidayRule: /Chinese public holidays|法定节假日|法定節假日/.test(sentence),
  };
}

/**
 * Render the windows as the constant client.js holds.
 * @param {Array<[number, number]>} windows - UTC minute pairs.
 * @returns {string} the whole declaration.
 */
function renderConstant(windows) {
  return `const PEAK_WINDOWS_UTC_MINUTES = [${windows.map(([start, end]) => `[${start}, ${end}]`).join(', ')}];`;
}

/**
 * Fetch the official schedule without touching any file.
 * @param {number} [timeoutMs] - per-request budget.
 * @returns {Promise<{url: string, sentence: string, windows: Array<[number, number]>, weekdayRule: boolean, holidayRule: boolean}>}
 */
export async function fetchOfficialSchedule(timeoutMs = 20000) {
  const { url, text } = await readSource(timeoutMs);
  return { url, ...parseSchedule(text) };
}

/**
 * Bring client.js in line with the official page.
 * @param {{write?: boolean, clientPath?: string, timeoutMs?: number}} [options] - behaviour knobs.
 * @returns {Promise<{status: 'unchanged' | 'updated' | 'stale', url: string, sentence: string,
 *   windows: Array<[number, number]>, weekdayRule: boolean, holidayRule: boolean,
 *   previous?: string, next?: string}>} what happened.
 */
export async function syncSchedule(options = {}) {
  const { write = true, clientPath = CLIENT, timeoutMs = 20000 } = options;
  const official = await fetchOfficialSchedule(timeoutMs);
  const next = renderConstant(official.windows);

  const source = await readFile(clientPath, 'utf8');
  const previous = /const PEAK_WINDOWS_UTC_MINUTES = .*?;/.exec(source)?.[0];
  if (previous === undefined) throw new Error('client.js no longer declares PEAK_WINDOWS_UTC_MINUTES');

  if (previous === next) return { ...official, status: 'unchanged' };
  if (!write) return { ...official, status: 'stale', previous, next };

  // Replace through a sibling temporary file so a reader never sees a partial write.
  const temporary = `${clientPath}.tmp`;
  await writeFile(temporary, source.replace(previous, next), 'utf8');
  await rename(temporary, clientPath);
  return { ...official, status: 'updated', previous, next };
}

/**
 * Format one window for a log line.
 * @param {[number, number]} window - UTC minute pair.
 * @returns {string} such as `01:00–04:00 UTC`.
 */
export function formatWindow([start, end]) {
  const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return `${clock(start)}–${clock(end)} UTC`;
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const checkOnly = process.argv.includes('--check');
    const result = await syncSchedule({ write: !checkOnly });
    console.log(`source:   ${result.url}`);
    console.log(`sentence: ${result.sentence}`);
    console.log(`windows:  ${result.windows.map(formatWindow).join(', ')}`);
    if (!result.weekdayRule) {
      console.warn('warning: the official sentence no longer says Monday through Friday; check the weekday rule in client.js');
    }
    if (!result.holidayRule) {
      console.warn('warning: the official sentence no longer excludes Chinese public holidays; check CHINA_HOLIDAY_RANGES in client.js');
    }
    if (result.status === 'unchanged') console.log('client.js is up to date');
    if (result.status === 'updated') {
      console.log(`client.js updated\n  was: ${result.previous}\n  now: ${result.next}`);
    }
    if (result.status === 'stale') {
      console.log(`client.js is stale; run without --check to update it\n  was: ${result.previous}\n  now: ${result.next}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}
