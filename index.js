/**
 * Host half of the peak reminder bundle.
 *
 * The reminder is computed and drawn in the browser. This half keeps the
 * published schedule current: DeepSeek exposes no pricing API, so it reads the
 * official pricing page's markdown at activation and again every twelve hours,
 * and rewrites the peak windows in client.js only when they actually differ.
 * An offline machine or an unreadable page leaves the file untouched, and the
 * built-in windows keep working.
 */
import { formatWindow, syncSchedule } from './scripts/sync-schedule.mjs';

/** Twice a day is far more often than the published schedule changes. */
const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
/** Set to false to stop the automatic refresh and rely on `scripts/sync-schedule.mjs`. */
const AUTO_SYNC = true;

/**
 * Mount the schedule refresh.
 * @param {import('@deepseek-ai/cordis').Context} ctx - the plugin context owning the timer.
 */
export function apply(ctx) {
  if (!AUTO_SYNC) return;

  ctx.effect(() => {
    let disposed = false;

    const run = async () => {
      try {
        const result = await syncSchedule({ write: true });
        if (disposed || result.status !== 'updated' || !result.clientChanged) return;
        console.log(
          `[peak-reminder] peak windows updated from ${result.url}: `
          + `${result.windows.map(formatWindow).join(', ')} — reload the page to apply`,
        );
      } catch {
        // Offline, or the page changed shape: the shipped windows stay authoritative.
      }
    };

    void run();
    const timer = setInterval(() => { void run(); }, SYNC_INTERVAL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, 'peak-reminder: official schedule sync');
}
