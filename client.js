/**
 * Peak reminder — browser half.
 *
 * Draws a status dot in the conversation header: red while DeepSeek API peak
 * hours are running, amber during the lead-in before a peak starts, and green
 * during the off-peak window. Clicking the dot opens a small card with the
 * countdown, a 24-hour ribbon, and the off-peak schedule; a one-shot toast
 * announces the moment a peak begins.
 *
 * The peak window is DeepSeek's published price schedule: Monday to Friday,
 * 01:00–04:00 and 06:00–10:00 UTC, excluding Chinese statutory holidays. Every
 * other hour is off-peak. Adjust the constants below to follow a different
 * schedule; everything else is derived from them.
 */
window.__ModuleLoader__.load({
  id: 'deepseek-harness-peak-reminder',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Where the browser copy of this bundle lives. */
    const NS = 'peakReminder';

    /**
     * DeepSeek's peak windows, in minutes of the UTC day, on weekdays:
     * 01:00–04:00 and 06:00–10:00 UTC (09:00–12:00 and 14:00–18:00 Beijing).
     * Everything outside them is billed off-peak.
     */
    const PEAK_WINDOWS_UTC_MINUTES = [[60, 240], [360, 600]];
    /** How long before a peak the dot turns amber. */
    const LEAD_MINUTES = 30;

    /**
     * Chinese statutory holidays, as Beijing calendar-date ranges. DeepSeek
     * bills these days off-peak all day; the list therefore has to be extended
     * once the State Council publishes the next year's arrangement. A date that
     * is missing here is simply treated as a normal weekday, never as an error.
     */
    const CHINA_HOLIDAY_RANGES = [
      ['2026-01-01', '2026-01-03'], // New Year
      ['2026-02-15', '2026-02-23'], // Spring Festival
      ['2026-04-04', '2026-04-06'], // Qingming
      ['2026-05-01', '2026-05-05'], // Labor Day
      ['2026-06-19', '2026-06-21'], // Dragon Boat
      ['2026-09-25', '2026-09-27'], // Mid-Autumn
      ['2026-10-01', '2026-10-07'], // National Day
    ];

    const DAY_MS = 86400000;
    const STATUS_TICK_MS = 20000;
    const CARD_TICK_MS = 1000;
    const TOAST_LIFETIME_MS = 7000;
    const CARD_WIDTH = 272;
    const CARD_GAP = 8;
    const RIBBON_STEPS = 96;

    /**
     * The published manifest. A packed or GitHub install cannot rewrite its own
     * files, so the browser follows this file; the built-in constants above stay
     * authoritative when it is unreachable or malformed.
     */
    const REMOTE_SCHEDULE_URL = 'https://raw.githubusercontent.com/Amir-Keshtkar/deepseek-harness-peak-reminder/main/schedule.json';
    const REMOTE_CACHE_KEY = 'dsh.peak-reminder.schedule';
    const REMOTE_TTL_MS = 6 * 3600000;
    const REMOTE_TIMEOUT_MS = 4000;

    /** Windows in force for this page; replaced by the published manifest when one loads. */
    let activeWindows = PEAK_WINDOWS_UTC_MINUTES;

    const COPY = {
      en: {
        'status.peak': 'Peak hours',
        'status.soon': 'Peak starts soon',
        'status.off': 'Off-peak',
        'caption.peak': 'Off-peak starts in',
        'caption.soon': 'Peak starts in',
        'caption.off': 'Peak starts in',
        'unit.d': 'd',
        'unit.h': 'h',
        'unit.m': 'm',
        'unit.s': 's',
        'axis.start': '00:00',
        'axis.mid': '12:00',
        'axis.end': '24:00',
        'ribbon.label': 'Peak windows: {range}',
        'boundary.start': 'Peak starts',
        'boundary.end': 'Peak ends',
        'foot.schedule': 'Peak {range} · Mon–Fri · {zone}',
        'foot.rest': 'Off-peak all day · {zone}',
        'toast.peak': 'Peak hours have started · off-peak in {remaining}',
        'pref.rtl': 'RTL',
        'pref.notify': 'Notify',
        'pref.rtl.aria': 'Right-to-left message text',
        'pref.notify.aria': 'Desktop notification when a reply or a question arrives',
        'notify.reply.title': 'DeepSeek replied',
        'notify.reply.body': 'The response is ready.',
        'notify.question.title': 'DeepSeek asked a question',
        'notify.question.body': 'Open DeepSeek Harness to answer.',
        'usage.label': 'Usage',
        'usage.session': 'This session',
        'usage.input': 'Input',
        'usage.cached': 'Cached',
        'usage.output': 'Output',
        'usage.speed': 'Speed',
        'usage.cost': 'Cost',
        'usage.turns': 'Turns',
        'usage.time': 'Time',
        'usage.model': 'Model',
        'usage.empty': 'No usage yet',
        'usage.estimate': 'Estimated at current rates',
        'usage.tokps': '{n} tok/s',
        'balance.label': 'Balance',
        'balance.total': 'Total balance',
        'balance.toppedUp': 'Topped up',
        'balance.granted': 'Granted',
        'balance.signedOut': 'Sign in to view',
        'balance.unavailable': 'Unavailable',
      },
      zh: {
        'status.peak': '高峰时段',
        'status.soon': '高峰即将开始',
        'status.off': '非高峰时段',
        'caption.peak': '距非高峰时段还有',
        'caption.soon': '距高峰开始还有',
        'caption.off': '距高峰开始还有',
        'unit.d': '天',
        'unit.h': '小时',
        'unit.m': '分',
        'unit.s': '秒',
        'axis.start': '00:00',
        'axis.mid': '12:00',
        'axis.end': '24:00',
        'ribbon.label': '高峰时段：{range}',
        'boundary.start': '高峰开始',
        'boundary.end': '高峰结束',
        'foot.schedule': '高峰 {range} · 周一至周五 · {zone}',
        'foot.rest': '全天非高峰 · {zone}',
        'toast.peak': '高峰时段已开始 · 距非高峰时段还有 {remaining}',
        'pref.rtl': '从右到左',
        'pref.notify': '通知',
        'pref.rtl.aria': '消息文本从右到左',
        'pref.notify.aria': '收到回复或提问时发送桌面通知',
        'notify.reply.title': 'DeepSeek 已回复',
        'notify.reply.body': '回复已准备好。',
        'notify.question.title': 'DeepSeek 有问题',
        'notify.question.body': '打开 DeepSeek Harness 回答。',
        'usage.label': '用量',
        'usage.session': '本会话',
        'usage.input': '输入',
        'usage.cached': '缓存命中',
        'usage.output': '输出',
        'usage.speed': '速度',
        'usage.cost': '费用',
        'usage.turns': '轮次',
        'usage.time': '用时',
        'usage.model': '模型',
        'usage.empty': '暂无用量',
        'usage.estimate': '按当前价格估算',
        'usage.tokps': '{n} tok/s',
        'balance.label': '余额',
        'balance.total': '总余额',
        'balance.toppedUp': '充值',
        'balance.granted': '赠送',
        'balance.signedOut': '登录后查看',
        'balance.unavailable': '不可用',
      },
    };

    /* --------------------------------------------------------------------- *
     * Time model
     * --------------------------------------------------------------------- */

    /**
     * Read one instant as minutes of the UTC day.
     * @param {number} ms - epoch milliseconds.
     * @returns {number} fractional minutes since 00:00 UTC.
     */
    function utcMinute(ms) {
      const date = new Date(ms);
      return date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    }

    /** Beijing calendar dates that DeepSeek bills off-peak all day. */
    const CHINA_HOLIDAYS = (() => {
      const days = new Set();
      for (const [from, to] of CHINA_HOLIDAY_RANGES) {
        const end = Date.parse(`${to}T00:00:00Z`);
        for (let at = Date.parse(`${from}T00:00:00Z`); at <= end; at += DAY_MS) {
          days.add(new Date(at).toISOString().slice(0, 10));
        }
      }
      return days;
    })();

    /**
     * The Beijing calendar date of one instant. China has kept UTC+8 without
     * daylight saving since 1991, so the offset is exact and cheaper than an
     * `Intl` call inside the transition scan.
     * @param {number} ms - epoch milliseconds.
     * @returns {string} `YYYY-MM-DD`.
     */
    function beijingDate(ms) {
      return new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
    }

    /**
     * Whether one instant falls on a Chinese statutory holiday.
     * @param {number} ms - epoch milliseconds.
     * @returns {boolean} true on a holiday.
     */
    function isHoliday(ms) {
      return CHINA_HOLIDAYS.has(beijingDate(ms));
    }

    /**
     * Whether one instant falls on a weekend or a Chinese statutory holiday,
     * which DeepSeek bills off-peak for the whole day.
     * @param {number} ms - epoch milliseconds.
     * @returns {boolean} true when the whole day is off-peak.
     */
    function isRestDay(ms) {
      const weekday = new Date(ms).getUTCDay();
      return weekday === 0 || weekday === 6 || isHoliday(ms);
    }

    /**
     * Whether one instant falls inside a peak window.
     * @param {number} ms - epoch milliseconds.
     * @returns {boolean} true during peak.
     */
    function isPeakAt(ms) {
      if (isRestDay(ms)) return false;
      const minute = utcMinute(ms);
      return activeWindows.some(([start, end]) => minute >= start && minute < end);
    }

    /**
     * The UTC instant of one minute-of-day on the instant's UTC calendar day.
     * @param {number} ms - reference instant.
     * @param {number} minute - minutes since 00:00 UTC.
     * @returns {number} epoch milliseconds.
     */
    function utcBoundary(ms, minute) {
      const date = new Date(ms);
      return Date.UTC(
        date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
        Math.floor(minute / 60), minute % 60, 0, 0,
      );
    }

    /**
     * The UTC instant of one minute-of-day a number of UTC days away.
     * @param {number} ms - reference instant.
     * @param {number} dayOffset - days added to the reference's UTC date.
     * @param {number} minute - minutes since 00:00 UTC.
     * @returns {number} epoch milliseconds.
     */
    function utcDayBoundary(ms, dayOffset, minute) {
      const date = new Date(ms);
      return Date.UTC(
        date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + dayOffset,
        Math.floor(minute / 60), minute % 60, 0, 0,
      );
    }

    /**
     * The next instant at which peak status flips, looking far enough ahead to
     * clear the longest holiday break (the nine-day Spring Festival).
     * @param {number} ms - epoch milliseconds.
     * @returns {number} the next transition instant.
     */
    function nextTransition(ms) {
      for (let offset = 0; offset <= 16; offset += 1) {
        for (const [start, end] of activeWindows) {
          for (const minute of [start, end]) {
            const instant = utcDayBoundary(ms, offset, minute);
            if (instant <= ms) continue;
            if (isPeakAt(instant) !== isPeakAt(instant - 1000)) return instant;
          }
        }
      }
      return ms + 3600000;
    }

    /**
     * Classify one instant and resolve the countdown target.
     * @param {number} ms - epoch milliseconds.
     * @returns {{mode: 'peak' | 'soon' | 'off', target: number, remaining: number}} the state.
     */
    function readState(ms) {
      const peak = isPeakAt(ms);
      const target = nextTransition(ms);
      const remaining = target - ms;
      return {
        mode: peak ? 'peak' : remaining <= LEAD_MINUTES * 60000 ? 'soon' : 'off',
        target,
        remaining,
      };
    }

    /**
     * Break a duration into at most two coarse units.
     * @param {number} ms - remaining milliseconds.
     * @param {(key: string) => string} t - localized copy.
     * @returns {string[]} one or two unit strings, such as `['3h', '12m']`.
     */
    function durationParts(ms, t) {
      const total = Math.max(0, Math.floor(ms / 1000));
      const days = Math.floor(total / 86400);
      const hours = Math.floor((total % 86400) / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      if (days > 0) return [`${days}${t('unit.d')}`, `${hours}${t('unit.h')}`];
      if (hours > 0) return [`${hours}${t('unit.h')}`, `${minutes}${t('unit.m')}`];
      if (minutes > 0) return [`${minutes}${t('unit.m')}`, `${seconds}${t('unit.s')}`];
      return [`${seconds}${t('unit.s')}`];
    }

    /** Lazily built 24-hour clock formatter, kept out of the one-second render. */
    let clockFormatter = null;

    /**
     * Format one instant as a local 24-hour clock time. The copy is English, so
     * the formatter is pinned to it rather than to a browser locale that might
     * substitute another digit set or hour cycle.
     * @param {number} ms - epoch milliseconds.
     * @returns {string} local time such as `20:00`.
     */
    function clockTime(ms) {
      if (clockFormatter === null) {
        clockFormatter = new Intl.DateTimeFormat('en', {
          hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        });
      }
      return clockFormatter.format(new Date(ms));
    }

    /** Cached reader time-zone name. */
    let zoneCache;

    /**
     * The reader's time-zone city, for the schedule footer.
     * @returns {string} a short zone name.
     */
    function zoneName() {
      if (zoneCache !== undefined) return zoneCache;
      try {
        const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
        zoneCache = zone === undefined ? 'local time' : zone.split('/').pop().replaceAll('_', ' ');
      } catch {
        zoneCache = 'local time';
      }
      return zoneCache;
    }

    /**
     * Both peak windows as local clock times.
     * @param {number} ms - reference instant.
     * @returns {string} ranges such as `04:30–07:30, 09:30–13:30`.
     */
    function peakRange(ms) {
      return activeWindows
        .map(([start, end]) => `${clockTime(utcBoundary(ms, start))}–${clockTime(utcBoundary(ms, end))}`)
        .join(', ');
    }

    /**
     * The peak boundaries inside the local day around one instant, in order.
     * @param {number} ms - reference instant.
     * @returns {number[]} instants at which peak status flips inside that day.
     */
    function dayBoundaries(ms) {
      const [start, end] = localDayBounds(ms);
      const boundaries = [];
      let cursor = start - 1;
      for (let index = 0; index < 8; index += 1) {
        const instant = nextTransition(cursor);
        if (instant <= start || instant >= end) break;
        boundaries.push(instant);
        cursor = instant;
      }
      return boundaries;
    }

    /**
     * The local calendar day around one instant. Boundaries come from the
     * calendar, not a fixed 24 hours, so a daylight-saving day keeps its own
     * length.
     * @param {number} ms - epoch milliseconds.
     * @returns {[number, number]} local midnight and the following local midnight.
     */
    function localDayBounds(ms) {
      const date = new Date(ms);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      return [start, end];
    }

    /**
     * Group a local day into consecutive peak and off-peak runs.
     * @param {number} ms - reference instant.
     * @returns {{key: 'peak' | 'off', count: number}[]} one entry per run.
     */
    function ribbonRuns(ms) {
      const [start, end] = localDayBounds(ms);
      const stepMs = (end - start) / RIBBON_STEPS;
      const runs = [];
      for (let index = 0; index < RIBBON_STEPS; index += 1) {
        const sample = start + index * stepMs + stepMs / 2;
        const key = isPeakAt(sample) ? 'peak' : 'off';
        const last = runs[runs.length - 1];
        if (last !== undefined && last.key === key) last.count += 1;
        else runs.push({ key, count: 1 });
      }
      return runs;
    }

    /**
     * How far into the local day the instant sits.
     * @param {number} ms - epoch milliseconds.
     * @returns {number} percentage between 0 and 100.
     */
    function dayProgress(ms) {
      const [start, end] = localDayBounds(ms);
      const span = end - start;
      if (span <= 0) return 0;
      return Math.min(100, Math.max(0, ((ms - start) / span) * 100));
    }

    /**
     * Accept only a plausible window list from the published manifest.
     * @param {unknown} value - the decoded JSON field.
     * @returns {Array<[number, number]> | null} sorted windows, or null when unusable.
     */
    function normalizeWindows(value) {
      if (!Array.isArray(value) || value.length === 0 || value.length > 4) return null;
      const windows = [];
      for (const pair of value) {
        if (!Array.isArray(pair) || pair.length !== 2) return null;
        const [start, end] = pair;
        if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
        if (start < 0 || end > 1440 || start >= end) return null;
        windows.push([start, end]);
      }
      windows.sort((a, b) => a[0] - b[0]);
      for (let index = 1; index < windows.length; index += 1) {
        if (windows[index][0] < windows[index - 1][1]) return null;
      }
      return windows;
    }

    /**
     * Adopt the published schedule, preferring a fresh fetch over a cached copy.
     * Every failure path leaves the windows already in force untouched.
     * @returns {Promise<void>} resolves once the attempt settles.
     */
    async function refreshSchedule() {
      try {
        const raw = localStorage.getItem(REMOTE_CACHE_KEY);
        if (raw !== null) {
          const cached = JSON.parse(raw);
          const windows = normalizeWindows(cached?.windows);
          if (windows !== null && typeof cached.at === 'number' && Date.now() - cached.at < REMOTE_TTL_MS) {
            activeWindows = windows;
          }
        }
      } catch {
        // A missing or unusable cache is not a failure.
      }

      try {
        const response = await fetch(REMOTE_SCHEDULE_URL, {
          cache: 'no-store',
          signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
        });
        if (!response.ok) return;
        const windows = normalizeWindows((await response.json()).windows);
        if (windows === null) return;
        activeWindows = windows;
        try {
          localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify({ at: Date.now(), windows }));
        } catch {
          // Storage may be unavailable; the in-memory value still applies.
        }
      } catch {
        // Offline or blocked: keep the built-in or cached windows.
      }
    }

    /* --------------------------------------------------------------------- *
     * Portal: optional, so the bundle still works without react-dom
     * --------------------------------------------------------------------- */

    let createPortal = null;
    try {
      const reactDom = require('react-dom');
      if (reactDom !== null && typeof reactDom.createPortal === 'function') {
        createPortal = reactDom.createPortal;
      }
    } catch {
      createPortal = null;
    }

    /**
     * Mount the card on the document body when the platform allows it, and
     * inline (fixed-positioned) otherwise.
     * @param {React.ReactElement} element - the card element.
     * @returns {React.ReactElement} the element to render.
     */
    function mountFloating(element) {
      if (createPortal === null || typeof document === 'undefined') return element;
      return createPortal(element, document.body);
    }

    /* --------------------------------------------------------------------- *
     * Components
     * --------------------------------------------------------------------- */

    /**
     * Keep one clock value live while a component is mounted.
     * @param {number} intervalMs - refresh period.
     * @returns {number} the current epoch milliseconds.
     */
    function useNow(intervalMs) {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        const timer = setInterval(() => { setNow(Date.now()); }, intervalMs);
        return () => { clearInterval(timer); };
      }, [intervalMs]);
      return now;
    }

    /* --------------------------------------------------------------------- *
     * Preferences, notifications, and the global surface
     * --------------------------------------------------------------------- */

    const PREF_KEY = 'dsh.peak-reminder.prefs';

    /** Durable switches shared by the card and the global surface. */
    const prefStore = (() => {
      let state = { rtl: true, notify: true };
      try {
        const raw = localStorage.getItem(PREF_KEY);
        if (raw !== null) {
          const saved = JSON.parse(raw);
          state = {
            rtl: typeof saved.rtl === 'boolean' ? saved.rtl : state.rtl,
            notify: typeof saved.notify === 'boolean' ? saved.notify : state.notify,
          };
        }
      } catch {
        // Private or full storage keeps the defaults for this page.
      }
      const listeners = new Set();
      return {
        get: () => state,
        set(patch) {
          state = { ...state, ...patch };
          try {
            localStorage.setItem(PREF_KEY, JSON.stringify(state));
          } catch {
            // The switch still applies to this page.
          }
          for (const listener of listeners) listener();
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
      };
    })();

    /**
     * Read the durable switches from React.
     * @returns {{rtl: boolean, notify: boolean}} the current preferences.
     */
    function usePrefs() {
      return React.useSyncExternalStore(prefStore.subscribe, prefStore.get);
    }

    /**
     * Show one desktop notification, unless the window is already in front.
     * Clicking it brings the window forward and opens the Session it described.
     * @param {string} title - headline text.
     * @param {string} body - supporting text.
     * @param {string | undefined} sessionId - the Session the notice is about.
     * @param {(sessionId: string) => void} [openSession] - navigation into that Session.
     * @returns {void}
     */
    function showNotification(title, body, sessionId, openSession) {
      if (!prefStore.get().notify) return;
      if (typeof Notification === 'undefined') return;
      if (document.visibilityState === 'visible' && document.hasFocus()) return;
      try {
        if (Notification.permission !== 'granted' && Notification.permission !== 'default') return;
        const notice = new Notification(title, { body, tag: 'dsh-peak-reminder' });
        notice.onclick = () => {
          notice.close();
          window.focus();
          if (typeof sessionId === 'string' && typeof openSession === 'function') {
            try {
              openSession(sessionId);
            } catch {
              // The window is already in front; navigation is an extra.
            }
          }
        };
      } catch {
        // A blocked or unsupported notification surface is not an error.
      }
    }

    /**
     * Watch session status and announce a finished reply or a new question.
     * @param {{useSessionStatus: Function, t: Function, openSession?: Function}} props - hooks, copy, navigation.
     * @returns {null} renders nothing.
     */
    function PeakNotifier(props) {
      const { useSessionStatus, t, openSession } = props;
      const statuses = useSessionStatus(value => value);
      const seen = React.useRef(new Map());

      React.useEffect(() => {
        if (statuses === undefined || statuses === null) return;
        const next = new Map();
        let replied = false;
        let asked = false;
        let target = undefined;
        for (const [sessionId, status] of statuses) {
          const before = seen.current.get(sessionId);
          const pending = status.pendingInteraction;
          const question = pending !== undefined && pending !== null && pending.kind === 'question'
            ? pending.key
            : null;
          next.set(sessionId, { running: status.running === true, question });
          if (before === undefined) continue;
          if (question !== null && question !== before.question) {
            asked = true;
            target = sessionId;
            continue;
          }
          if (before.running && status.running !== true) {
            replied = true;
            if (target === undefined) target = sessionId;
          }
        }
        seen.current = next;
        if (asked) {
          showNotification(t('notify.question.title'), t('notify.question.body'), target, openSession);
          return;
        }
        if (replied) showNotification(t('notify.reply.title'), t('notify.reply.body'), target, openSession);
      }, [statuses, t]);

      return null;
    }

    /**
     * Root-scoped surface: the RTL stylesheet and the notification watcher.
     * @param {{t: Function, useSessionStatus?: Function, openSession?: Function}} props - copy, hook, navigation.
     * @returns {React.ReactElement | null} the stylesheet while RTL is on.
     */
    function PeakGlobal(props) {
      const { t, useSessionStatus, openSession } = props;
      const prefs = usePrefs();
      return h(React.Fragment, null,
        prefs.rtl ? h('style', { 'data-peak-reminder': 'rtl' }, RTL_CSS) : null,
        typeof useSessionStatus === 'function'
          ? h(PeakNotifier, { useSessionStatus, t, openSession })
          : null,
      );
    }

    /* --------------------------------------------------------------------- *
     * Usage
     * --------------------------------------------------------------------- */

    /**
     * DeepSeek list prices in USD per million tokens. Off-peak is half of peak
     * on every bucket, which is why the table carries both.
     */
    const PRICE_TABLE = {
      flash: {
        off: { input: 0.15, cached: 0.003, output: 0.6 },
        peak: { input: 0.3, cached: 0.006, output: 1.2 },
      },
      pro: {
        off: { input: 0.66, cached: 0.022, output: 1.98 },
        peak: { input: 1.32, cached: 0.044, output: 3.96 },
      },
    };

    /**
     * Which price row a model id belongs to.
     * @param {unknown} model - model id reported for the session, when known.
     * @returns {'flash' | 'pro'} the price family.
     */
    function priceFamily(model) {
      return typeof model === 'string' && /pro/i.test(model) ? 'pro' : 'flash';
    }

    /**
     * Estimate the cost of one session's tokens at the rate in force.
     * @param {{uncachedInputTokens?: number, cacheReadTokens?: number, outputTokens?: number}} usage - token buckets.
     * @param {unknown} model - model id, when known.
     * @param {boolean} peak - whether peak rates apply.
     * @returns {number} estimated US dollars.
     */
    function estimateCost(usage, model, peak) {
      const family = PRICE_TABLE[priceFamily(model)];
      const prices = peak ? family.peak : family.off;
      return (Number(usage.uncachedInputTokens) || 0) / 1e6 * prices.input
        + (Number(usage.cacheReadTokens) || 0) / 1e6 * prices.cached
        + (Number(usage.outputTokens) || 0) / 1e6 * prices.output;
    }

    /**
     * Compact a token count for a narrow surface.
     * @param {number} value - raw tokens.
     * @returns {string} such as `12.4k`.
     */
    function formatTokens(value) {
      const count = Number(value) || 0;
      if (count >= 1e6) return `${(count / 1e6).toFixed(2)}M`;
      if (count >= 1e3) return `${(count / 1e3).toFixed(1)}k`;
      return String(Math.round(count));
    }

    /**
     * Format an estimated cost.
     * @param {number} value - US dollars.
     * @returns {string} such as `$0.031`.
     */
    function formatCost(value) {
      if (!Number.isFinite(value) || value <= 0) return '$0';
      return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(3)}`;
    }

    /**
     * Format a duration for the usage rows.
     * @param {number} value - milliseconds.
     * @returns {string} such as `2m 14s`.
     */
    function formatDuration(value) {
      const total = Math.max(0, Math.round(Number(value) || 0));
      const seconds = Math.round(total / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    }

    /**
     * The Session shown in the main view, from the list snapshot. This is the
     * same reference test the Session controller itself publishes with.
     * @param {object} state - the Session list snapshot.
     * @returns {string | undefined} the current session id.
     */
    function currentSessionId(state) {
      const rows = state?.byId;
      if (rows === undefined || rows === null) return undefined;
      const found = Object.values(rows).find(row => ((row?.retainedBy?.mainView) ?? 0) > 0);
      return found?.id;
    }

    /**
     * A minimal observable snapshot the plugin publishes itself.
     * @param {unknown} initial - first value.
     * @returns {{getSnapshot: Function, subscribe: Function, set: Function}} the store.
     */
    function createStore(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
        set(next) {
          if (Object.is(next, value)) return;
          value = next;
          for (const listener of listeners) listener();
        },
      };
    }

    /**
     * Format one wallet amount with its currency symbol.
     * @param {string} amount - decimal string from the account service.
     * @param {string} currency - `USD`, `CNY`, or anything else.
     * @returns {string} such as `¥12.40`.
     */
    function formatMoney(amount, currency) {
      const symbol = currency === 'CNY' ? '¥' : '$';
      const value = Number(amount);
      if (!Number.isFinite(value)) return `${symbol}0.00`;
      if (value > 0 && value < 0.01) return `<${symbol}0.01`;
      return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Read one balance bucket as display text.
     * @param {unknown} wallets - wallet rows from the account service.
     * @returns {string | null} joined amounts, or null when there is nothing to show.
     */
    function balanceText(wallets) {
      if (!Array.isArray(wallets)) return null;
      const shown = wallets
        .filter(wallet => wallet !== null && typeof wallet === 'object' && Number.isFinite(Number(wallet.balance)))
        .map(wallet => formatMoney(wallet.balance, wallet.currency));
      return shown.length === 0 ? null : shown.join(' · ');
    }

    /**
     * Add wallet rows together, one total per currency.
     * @param {...unknown} groups - wallet arrays from the account service.
     * @returns {{currency: string, balance: string}[]} one row per currency.
     */
    function sumWallets(...groups) {
      const totals = new Map();
      for (const group of groups) {
        if (!Array.isArray(group)) continue;
        for (const wallet of group) {
          if (wallet === null || typeof wallet !== 'object') continue;
          const value = Number(wallet.balance);
          if (!Number.isFinite(value)) continue;
          const currency = wallet.currency === 'CNY' ? 'CNY' : 'USD';
          totals.set(currency, (totals.get(currency) ?? 0) + value);
        }
      }
      return [...totals].map(([currency, amount]) => ({ currency, balance: String(Math.round(amount * 100) / 100) }));
    }

    /**
     * One labelled row in the usage panel.
     * @param {{label: string, value: string, hint?: string}} props - row content.
     * @returns {React.ReactElement} the row.
     */
    function UsageRow(props) {
      return h('div', { className: 'peakr-usage-row' },
        h('span', { className: 'peakr-usage-key' }, props.label),
        h('span', { className: 'peakr-usage-num' }, props.value),
        props.hint === undefined ? null : h('span', { className: 'peakr-usage-hint' }, props.hint),
      );
    }

    /** Stable selector for readers that have no balance source. */
    function useNothing() {
      return undefined;
    }

    /**
     * Read an external store as a React value, for slots that pass the store
     * itself instead of a ready-made hook.
     * @param {object} store - snapshot store with subscribe and getSnapshot.
     * @param {Function} selector - maps the snapshot to the rendered value.
     * @returns {unknown} the selected snapshot.
     */
    function useSnapshotStore(store, selector) {
      const read = React.useCallback(() => store.getSnapshot(), [store]);
      return selector(React.useSyncExternalStore(store.subscribe, read, read));
    }

    /**
     * The account balance, kept in its own tinted band so it never reads as a
     * session metric. It always renders: the headline is the charged total, the
     * note splits it into the topped-up and granted wallets.
     * @param {{t: Function, balance: object | undefined}} props - copy and the balance snapshot.
     * @returns {React.ReactElement} the band.
     */
    function BalanceBand(props) {
      const { t, balance } = props;
      const ready = balance !== undefined && balance !== null && balance.status === 'ready';

      let main;
      let extra = null;
      if (ready) {
        main = balanceText(sumWallets(balance.value, balance.bonusWallets)) ?? formatMoney('0', 'USD');
        const toppedUp = balanceText(balance.value);
        const granted = balanceText(balance.bonusWallets);
        const parts = [];
        if (toppedUp !== null) parts.push(`${t('balance.toppedUp')} ${toppedUp}`);
        if (granted !== null) parts.push(`${t('balance.granted')} ${granted}`);
        if (parts.length > 0) extra = parts.join(' · ');
      } else if (balance === undefined || balance === null) {
        main = '…';
      } else if (balance.status === 'signedOut') {
        main = t('balance.signedOut');
      } else {
        main = t('balance.unavailable');
      }

      return h('div', {
        className: 'peakr-balance',
        'data-peakr-balance': balance === undefined || balance === null ? 'loading' : balance.status,
      },
        h('span', { className: 'peakr-balance-key' },
          h('svg', {
            width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': 'true', className: 'peakr-balance-icon',
          },
          h('rect', {
            x: 2, y: 4, width: 12, height: 9, rx: 2.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
          }),
          h('circle', { cx: 11, cy: 8.5, r: 1.1, fill: 'currentColor' }),
          ),
          t(ready ? 'balance.total' : 'balance.label'),
        ),
        h('span', {
          className: ready ? 'peakr-balance-value' : 'peakr-balance-value is-muted',
        }, main),
        extra === null ? null : h('span', { className: 'peakr-balance-extra' }, extra),
      );
    }

    /**
     * The sidebar usage button and its breakdown panel.
     * @param {{t: Function, wide: boolean, useSessions: Function}} props - copy and the session hook.
     * @returns {React.ReactElement | null} the entry, or nothing without the session source.
     */
    function UsageEntry(props) {
      if (typeof props.useSessions !== 'function') return null;
      return h(UsageButton, props);
    }

    /**
     * Read one session's token buckets and timings.
     * @param {{t: Function, wide: boolean, useSessions: Function}} props - copy and the session hook.
     * @returns {React.ReactElement} the button with its panel.
     */
    function UsageButton(props) {
      const { t, wide, useSessions, refreshBalance } = props;
      const useBalance = typeof props.useBalance === 'function'
        ? props.useBalance
        : (props.hooks !== undefined && props.hooks.balance !== undefined
          && typeof props.hooks.balance.subscribe === 'function'
          ? selector => useSnapshotStore(props.hooks.balance, selector)
          : useNothing);
      const sessionId = useSessions(currentSessionId);
      const pick = field => state => (sessionId === undefined
        ? undefined
        : state?.projectionsBySession?.[sessionId]?.values?.[field]);
      const usage = useSessions(pick('tokenUsage')) ?? {};
      const stats = useSessions(pick('sessionStats')) ?? {};
      const model = useSessions(state => (sessionId === undefined
        ? undefined
        : state?.byId?.[sessionId]?.model));
      const balance = useBalance(value => value);
      const now = useNow(60000);
      const peak = isPeakAt(now);

      const input = Number(usage.uncachedInputTokens) || 0;
      const cached = Number(usage.cacheReadTokens) || 0;
      const output = Number(usage.outputTokens) || 0;
      const total = input + cached + output;
      const cost = estimateCost(usage, model, peak);
      const speed = Number(stats.decodeMs) > 0
        ? Math.round((Number(stats.decodeTokens) || 0) / (Number(stats.decodeMs) / 1000))
        : undefined;

      const [position, setPosition] = React.useState(null);
      const triggerRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const open = position !== null;

      const place = React.useCallback(() => {
        const trigger = triggerRef.current;
        if (trigger === null) return;
        if (typeof refreshBalance === 'function') refreshBalance(true);
        const rect = trigger.getBoundingClientRect();
        const width = Math.min(252, window.innerWidth - 16);
        setPosition({
          bottom: window.innerHeight - rect.top + 8,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
          width,
          maxHeight: Math.max(160, rect.top - 16),
        });
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;
        const inside = target => (triggerRef.current !== null && triggerRef.current.contains(target))
          || (panelRef.current !== null && panelRef.current.contains(target));
        const dismiss = event => { if (!inside(event.target)) setPosition(null); };
        const escape = event => {
          if (event.key !== 'Escape' || !inside(document.activeElement)) return;
          setPosition(null);
          triggerRef.current?.focus();
        };
        const relayout = () => { setPosition(null); };
        document.addEventListener('pointerdown', dismiss, true);
        document.addEventListener('keydown', escape);
        window.addEventListener('resize', relayout);
        return () => {
          document.removeEventListener('pointerdown', dismiss, true);
          document.removeEventListener('keydown', escape);
          window.removeEventListener('resize', relayout);
        };
      }, [open]);

      const summary = total === 0 ? '—' : `${formatTokens(total)} · ${formatCost(cost)}`;
      const panel = open ? mountFloating(h('div', {
        ref: panelRef,
        className: 'peakr-card peakr-usage-card',
        style: position,
        role: 'group',
        'aria-label': t('usage.label'),
      },
      h('div', { className: 'peakr-head' },
        h('span', { className: 'peakr-title' }, t('usage.label')),
        h('span', { className: 'peakr-usage-scope' }, t('usage.session')),
      ),
      h('div', { className: 'peakr-usage-rows' },
        h(UsageRow, { label: t('usage.input'), value: formatTokens(input) }),
        h(UsageRow, { label: t('usage.cached'), value: formatTokens(cached) }),
        h(UsageRow, { label: t('usage.output'), value: formatTokens(output) }),
        speed === undefined ? null : h(UsageRow, { label: t('usage.speed'), value: t('usage.tokps', { n: speed }) }),
        h(UsageRow, { label: t('usage.turns'), value: String(Number(stats.turns) || 0), hint: stats.llmMs === undefined ? undefined : formatDuration(stats.llmMs) }),
        typeof model === 'string' && model !== '' ? h(UsageRow, { label: t('usage.model'), value: model }) : null,
        h(UsageRow, { label: t('usage.cost'), value: formatCost(cost) }),
      ),
      h('div', { className: 'peakr-usage-note' }, t('usage.estimate')),
      h(BalanceBand, { t, balance }),
      )) : null;

      return h('div', { className: 'peakr-usage-root' },
        h(Style),
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'peakr-usage',
          'data-wide': wide,
          'aria-expanded': open,
          title: total === 0 ? t('usage.empty') : summary,
          onClick: () => { if (open) setPosition(null); else place(); },
        },
        h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': 'true', className: 'peakr-usage-icon' },
          h('rect', { x: 2, y: 9, width: 3, height: 5, rx: 1, fill: 'currentColor', opacity: 0.5 }),
          h('rect', { x: 6.5, y: 5, width: 3, height: 9, rx: 1, fill: 'currentColor', opacity: 0.72 }),
          h('rect', { x: 11, y: 2, width: 3, height: 12, rx: 1, fill: 'currentColor' }),
        ),
        wide ? h('span', { className: 'peakr-usage-name' }, t('usage.label')) : null,
        h('span', { className: 'peakr-usage-value' }, summary),
        ),
        panel,
      );
    }

    /**
     * The component-local stylesheet: mounted and removed with its component.
     * @returns {React.ReactElement} a style element.
     */
    function Style() {
      return h('style', { 'data-peak-reminder': '' }, CSS);
    }

    /**
     * Resolve the card's fixed position against the trigger it belongs to,
     * flipping above when below is cramped and never letting the card overflow
     * the viewport.
     * @param {{top: number, right: number, left: number, bottom: number}} rect - trigger box.
     * @returns {object} CSS position properties.
     */
    function cardPosition(rect) {
      const width = Math.min(CARD_WIDTH, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const estimated = 250;
      const below = rect.bottom + CARD_GAP;
      const fitsBelow = below + estimated <= window.innerHeight - 8;
      if (!fitsBelow && rect.top - CARD_GAP - estimated >= 8) {
        return {
          bottom: window.innerHeight - rect.top + CARD_GAP,
          left,
          width,
          maxHeight: Math.max(160, rect.top - CARD_GAP - 16),
        };
      }
      const top = Math.max(8, below);
      return {
        top,
        left,
        width,
        maxHeight: Math.max(160, window.innerHeight - top - 8),
      };
    }

    /**
     * The detail card: status, countdown, day ribbon, and schedule.
     * @param {{t: Function, cardRef: object, style: object}} props - copy, ref, position.
     * @returns {React.ReactElement} the card.
     */
    function PeakCard(props) {
      const { t, cardRef, cardId, style } = props;
      const now = useNow(CARD_TICK_MS);
      const state = readState(now);
      const remaining = durationParts(state.remaining, t).join(' ');
      // The ribbon only changes when the local day does, so the once-a-second
      // tick rebuilds the countdown and marker without rebuilding it.
      const dayStart = localDayBounds(now)[0];
      const runs = React.useMemo(() => ribbonRuns(now), [dayStart]);
      const boundaries = React.useMemo(() => dayBoundaries(now), [dayStart]);
      const [tip, setTip] = React.useState(null);
      const prefs = usePrefs();

      return h('div', {
        ref: cardRef,
        id: cardId,
        className: 'peakr-card',
        style,
        role: 'group',
        'aria-label': t('status.' + state.mode),
      },
      h('div', { className: 'peakr-head' },
        h('span', { className: 'peakr-dot', 'data-mode': state.mode }),
        h('span', { className: 'peakr-title' }, t('status.' + state.mode)),
      ),
      h('div', { className: 'peakr-count' },
        h('span', { className: 'peakr-caption' }, t('caption.' + state.mode)),
        h('span', { className: 'peakr-value' }, remaining),
      ),
      h('div', { className: 'peakr-track' },
        h('div', {
          className: 'peakr-ribbon',
          role: 'img',
          'aria-label': t('ribbon.label', { range: peakRange(now) }),
        },
          runs.map((run, index) => h('span', {
            key: index,
            className: 'peakr-seg',
            'data-k': run.key,
            style: { flexGrow: run.count },
          })),
        ),
        h('span', {
          className: 'peakr-marker',
          style: { left: `${dayProgress(now)}%` },
          'aria-hidden': 'true',
        }),
        boundaries.map((instant, index) => {
          const left = dayProgress(instant);
          const opens = isPeakAt(instant);
          const label = `${t(opens ? 'boundary.start' : 'boundary.end')} · ${clockTime(instant)}`;
          const show = () => { setTip({ key: index, left, label }); };
          const hide = () => {
            setTip(current => (current !== null && current.key === index ? null : current));
          };
          return h('span', {
            key: index,
            className: 'peakr-boundary',
            style: { left: `${left}%` },
            tabIndex: 0,
            role: 'note',
            'aria-label': label,
            onMouseEnter: show,
            onMouseLeave: hide,
            onFocus: show,
            onBlur: hide,
          });
        }),
        tip === null
          ? null
          : h('span', {
            className: 'peakr-tip',
            style: { left: `${tip.left}%` },
            role: 'tooltip',
          }, tip.label),
      ),
      h('div', { className: 'peakr-axis', 'aria-hidden': 'true' },
        h('span', null, t('axis.start')),
        h('span', null, t('axis.mid')),
        h('span', null, t('axis.end')),
      ),
      h('div', { className: 'peakr-foot' },
        isRestDay(now)
          ? t('foot.rest', { zone: zoneName() })
          : t('foot.schedule', { range: peakRange(now), zone: zoneName() }),
      ),
      h('div', { className: 'peakr-prefs' },
        h('button', {
          type: 'button',
          role: 'switch',
          className: 'peakr-switch',
          'aria-checked': prefs.rtl,
          'aria-label': t('pref.rtl.aria'),
          onClick: () => { prefStore.set({ rtl: !prefs.rtl }); },
        },
        h('span', { className: 'peakr-knob', 'data-on': prefs.rtl }),
        h('span', null, t('pref.rtl')),
        ),
        h('button', {
          type: 'button',
          role: 'switch',
          className: 'peakr-switch',
          'aria-checked': prefs.notify,
          'aria-label': t('pref.notify.aria'),
          onClick: () => { prefStore.set({ notify: !prefs.notify }); },
        },
        h('span', { className: 'peakr-knob', 'data-on': prefs.notify }),
        h('span', null, t('pref.notify')),
        ),
      ));
    }

    /**
     * The header entry: a pulsing status dot and its detail card.
     * @param {{t: Function}} props - localized copy.
     * @returns {React.ReactElement} the entry.
     */
    function PeakDot(props) {
      const { t } = props;
      const now = useNow(STATUS_TICK_MS);
      const state = readState(now);
      const status = t('status.' + state.mode);
      const summary = `${status} · ${t('caption.' + state.mode)} ${durationParts(state.remaining, t).join(' ')}`;
      const cardId = `peakr-card-${React.useId().replaceAll(':', '')}`;
      const [position, setPosition] = React.useState(null);
      const triggerRef = React.useRef(null);
      const cardRef = React.useRef(null);
      const open = position !== null;

      const place = React.useCallback(() => {
        const trigger = triggerRef.current;
        if (trigger === null) return;
        setPosition(cardPosition(trigger.getBoundingClientRect()));
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;
        const inside = target => (triggerRef.current !== null && triggerRef.current.contains(target))
          || (cardRef.current !== null && cardRef.current.contains(target));
        const dismiss = event => {
          if (inside(event.target)) return;
          setPosition(null);
        };
        const escape = event => {
          if (event.key !== 'Escape') return;
          if (!inside(document.activeElement)) return;
          setPosition(null);
          triggerRef.current?.focus();
        };
        const focusLeft = event => {
          // Focus falling back to the document is a blur, not a move to another
          // control; the pointer handler above owns that case.
          if (inside(event.target) || event.target === document.body) return;
          setPosition(null);
        };
        document.addEventListener('pointerdown', dismiss, true);
        document.addEventListener('keydown', escape);
        document.addEventListener('focusin', focusLeft);
        window.addEventListener('resize', place);
        return () => {
          document.removeEventListener('pointerdown', dismiss, true);
          document.removeEventListener('keydown', escape);
          document.removeEventListener('focusin', focusLeft);
          window.removeEventListener('resize', place);
        };
      }, [open, place]);

      return h('div', { className: 'peakr-root' },
        h(Style),
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'peakr-trigger',
          title: summary,
          'aria-label': summary,
          'aria-expanded': open,
          'aria-controls': open ? cardId : undefined,
          onClick: () => {
            if (open) { setPosition(null); return; }
            place();
          },
        }, h('span', { className: 'peakr-dot', 'data-mode': state.mode })),
        open
          ? mountFloating(h(PeakCard, { t, cardRef, cardId, style: position }))
          : null,
      );
    }

    /**
     * The one-shot reminder shown when a peak window begins.
     * @param {{t: Function}} props - localized copy.
     * @returns {React.ReactElement | null} the toast while it shows.
     */
    function PeakToast(props) {
      const { t } = props;
      const copy = React.useRef(t);
      copy.current = t;
      const [notice, setNotice] = React.useState(null);
      const lastMode = React.useRef(readState(Date.now()).mode);
      const lastTick = React.useRef(Date.now());

      React.useEffect(() => {
        const tick = () => {
          const now = Date.now();
          const next = readState(now);
          const before = lastMode.current;
          // A long gap means the window was throttled or the machine slept:
          // the boundary may be hours old, so it is history, not news.
          const fresh = now - lastTick.current <= STATUS_TICK_MS * 2.5;
          lastMode.current = next.mode;
          lastTick.current = now;
          if (fresh && before !== 'peak' && next.mode === 'peak') {
            setNotice({ id: now, remaining: next.remaining });
          }
        };
        const timer = setInterval(tick, STATUS_TICK_MS);
        return () => { clearInterval(timer); };
      }, []);

      React.useEffect(() => {
        if (notice === null) return undefined;
        const timer = setTimeout(() => { setNotice(null); }, TOAST_LIFETIME_MS);
        return () => { clearTimeout(timer); };
      }, [notice]);

      if (notice === null) return null;
      return h('div', {
        key: notice.id,
        className: 'peakr-toast',
        role: 'status',
        onClick: () => { setNotice(null); },
      },
      h(Style),
      h('span', { className: 'peakr-dot', 'data-mode': 'peak' }),
      h('span', null, copy.current('toast.peak', {
        remaining: durationParts(notice.remaining, copy.current).join(' '),
      })),
      );
    }

    /* --------------------------------------------------------------------- *
     * Styles — theme tokens only, so light and dark stay consistent.
     * --------------------------------------------------------------------- */

    /**
     * Direction overrides for conversation text. Every selector is a stable
     * attribute or a CSS-module local name; code and formulas stay left to
     * right so blocks, equations, and diffs keep their meaning.
     */
    const RTL_CSS = `
[data-chat-flow-kind="assistant-step"] [class*="_markdown"],
[data-chat-flow-kind="user"] [class*="_markdown"],
[data-chat-flow-kind="steering"] [class*="_markdown"],
[data-message-bubble],
[data-row-key^="session:"] [class*="_title"],
[data-row-key^="workspace:"] [class*="_title"],
[data-question-key],
[data-question-key] [role="radiogroup"],
[data-question-key] [role="group"],
[data-question-key] [data-option-row],
[data-question-key] [data-option-line],
[data-question-key] [data-option-description] {
  direction: rtl;
  text-align: start;
}
[data-chat-flow-kind] [data-code-wrap],
[data-chat-flow-kind] pre,
[data-chat-flow-kind] code,
[data-question-key] code,
.katex-display,
.peakr-card,
.peakr-toast,
.peakr-tip {
  direction: ltr;
  text-align: left;
}
/* A Markdown file opened from the files panel reads right to left as well; its
   code, YAML frontmatter, and formulas keep their own direction. */
[data-document-markdown],
[data-document-markdown] [class*="_markdown"] {
  direction: rtl;
  text-align: start;
}
[data-document-markdown] pre,
[data-document-markdown] code,
[data-document-markdown] [data-code-wrap],
[data-document-markdown] [data-document-frontmatter],
[data-document-markdown] .katex-display {
  direction: ltr;
  text-align: left;
}
`;

    const CSS = `
.peakr-root { display: inline-flex; align-items: center; }
.peakr-trigger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: 0; border-radius: 28px;
  background: transparent; cursor: pointer;
}
.peakr-trigger:hover { background: var(--dsw-alias-interactive-bg-hover); }
.peakr-trigger:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
.peakr-trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover); }

.peakr-dot {
  position: relative; display: inline-block; width: 10px; height: 10px;
  border-radius: 50%; flex: none;
  transition: background-color 220ms ease;
  /* A hairline in the label ink keeps the hue from carrying the state alone
     and holds the dot's edge on both themes. */
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent);
}
.peakr-dot[data-mode='peak'] {
  background: var(--dsw-alias-state-error-primary);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent),
    0 0 7px 1px color-mix(in srgb, var(--dsw-alias-state-error-primary) 50%, transparent);
}
.peakr-dot[data-mode='soon'] {
  background: var(--dsw-alias-state-warn-primary);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent),
    0 0 0 3.5px color-mix(in srgb, var(--dsw-alias-state-warn-primary) 38%, transparent);
}
.peakr-dot[data-mode='off'] { background: var(--dsw-alias-state-success-primary); }

.peakr-dot[data-mode='peak']::after,
.peakr-dot[data-mode='soon']::after {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: inherit; animation: peakr-pulse 1.9s cubic-bezier(.2, .6, .3, 1) infinite;
}
.peakr-dot[data-mode='peak']::after { animation-duration: 1.4s; }

@keyframes peakr-pulse {
  0% { transform: scale(1); opacity: .55; }
  70% { transform: scale(2.7); opacity: 0; }
  100% { transform: scale(2.7); opacity: 0; }
}

.peakr-card {
  position: fixed; z-index: 120; box-sizing: border-box;
  direction: ltr; text-align: left;
  padding: 12px 14px 11px; border-radius: 16px;
  overflow: auto;
  background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  box-shadow: var(--dsw-elevation-prominent);
  outline: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
  font-size: 13px; line-height: 18px;
}
.peakr-head { display: flex; align-items: center; gap: 8px; }
.peakr-title { font-weight: 600; }
.peakr-count { display: flex; flex-direction: column; gap: 1px; margin-top: 10px; }
.peakr-caption { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.peakr-value {
  font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -.01em;
  font-variant-numeric: tabular-nums;
}
.peakr-track { position: relative; margin-top: 14px; direction: ltr; }
.peakr-ribbon {
  display: flex; height: 10px; border-radius: 6px; overflow: hidden;
  background: var(--dsw-alias-border-l1);
}
.peakr-seg { height: 100%; min-width: 1px; }
.peakr-seg[data-k='peak'] {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 78%, transparent);
}
.peakr-seg[data-k='off'] {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 58%, transparent);
}
.peakr-marker {
  position: absolute; top: -3px; width: 2px; height: 16px; margin-left: -1px;
  border-radius: 2px; background: var(--dsw-alias-label-primary);
  box-shadow: 0 0 0 2px var(--dsw-specific-menu);
}
/* Only the points where peak flips are hover targets, not the whole ribbon. */
.peakr-boundary {
  position: absolute; top: -5px; width: 18px; height: 20px; margin-left: -9px;
  border-radius: 6px; cursor: help;
}
.peakr-boundary:hover,
.peakr-boundary:focus-visible {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
}
.peakr-boundary::before {
  content: ''; position: absolute; left: 50%; top: 5px; width: 1px; height: 10px;
  margin-left: -0.5px; border-radius: 1px; pointer-events: none;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent);
}
.peakr-boundary:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.peakr-tip {
  position: absolute; bottom: calc(100% + 4px); left: 0; z-index: 3;
  transform: translateX(-50%); pointer-events: none; white-space: nowrap;
  padding: 3px 8px; border-radius: 8px;
  background: var(--dsw-specific-menu);
  color: var(--dsw-alias-label-primary);
  outline: 1px solid var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums;
}
.peakr-axis {
  display: flex; justify-content: space-between; margin-top: 6px;
  color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 15px;
}
.peakr-foot {
  margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px;
}
.peakr-prefs { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0 0 -4px; }
.peakr-switch {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px 3px 5px; border: 0; border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 11px; line-height: 16px; cursor: pointer;
}
.peakr-switch:hover { background: var(--dsw-alias-interactive-bg-hover); }
.peakr-switch:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
.peakr-knob {
  position: relative; flex: none; width: 18px; height: 10px; border-radius: 999px;
  background: var(--dsw-alias-border-l1);
  transition: background-color 160ms ease;
}
.peakr-knob::after {
  content: ''; position: absolute; top: 1px; left: 1px; width: 8px; height: 8px;
  border-radius: 50%; background: var(--dsw-specific-menu);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary) 35%, transparent);
  transition: transform 160ms ease;
}
.peakr-knob[data-on='true'] { background: var(--dsw-alias-state-business-primary); }
.peakr-knob[data-on='true']::after { transform: translateX(8px); }

.peakr-usage-root { display: inline-flex; min-width: 0; }
.peakr-usage {
  display: inline-flex; align-items: center; gap: 6px; height: 28px;
  padding: 0 9px; border: 0; border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px;
  line-height: 16px; cursor: pointer; min-width: 0;
}
.peakr-usage:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.peakr-usage:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
.peakr-usage-icon { flex: none; }
.peakr-usage-name { white-space: nowrap; }
.peakr-usage-value {
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.peakr-usage[data-wide='false'] .peakr-usage-value { display: none; }

.peakr-usage-card { width: 252px; }
.peakr-usage-scope {
  margin-left: auto; color: var(--dsw-alias-label-tertiary);
  font-size: 11px; font-weight: 400;
}
.peakr-usage-rows { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.peakr-usage-row { display: flex; align-items: baseline; gap: 8px; font-size: 12px; line-height: 17px; }
.peakr-usage-key { color: var(--dsw-alias-label-secondary); }
.peakr-usage-num {
  margin-left: auto; color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
}
.peakr-usage-hint { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.peakr-usage-note {
  margin-top: 6px;
  color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 15px;
}
.peakr-balance {
  display: grid; grid-template-columns: auto 1fr; gap: 2px 8px;
  margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent);
}
.peakr-balance-key {
  display: inline-flex; align-items: center; gap: 5px;
  color: var(--dsw-alias-label-secondary); font-size: 11px;
}
.peakr-balance-icon { flex: none; }
.peakr-balance-value {
  justify-self: end; color: var(--dsw-alias-label-primary);
  font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
}
.peakr-balance-value.is-muted {
  font-size: 11px; font-weight: 400; color: var(--dsw-alias-label-tertiary);
}
.peakr-balance-extra {
  grid-column: 1 / -1; color: var(--dsw-alias-label-tertiary);
  font-size: 11px; line-height: 15px;
}

.peakr-toast {
  position: fixed; z-index: 130; left: 50%; pointer-events: auto; cursor: pointer;
  direction: ltr; text-align: left;
  top: max(16px, var(--dsh-frame-overlay-top, 16px));
  display: flex; align-items: center; gap: 9px;
  max-width: min(460px, calc(100vw - 32px)); box-sizing: border-box;
  padding: 9px 15px; border-radius: 999px;
  background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  box-shadow: var(--dsw-elevation-prominent);
  outline: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
  font-size: 12.5px; line-height: 18px;
  animation: peakr-toast-in 220ms ease-out both;
}
@keyframes peakr-toast-in {
  from { opacity: 0; transform: translate(-50%, -6px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .peakr-dot::after { animation: none; opacity: 0; }
  .peakr-toast { animation: none; transform: translate(-50%, 0); }
}
`;

    /* --------------------------------------------------------------------- *
     * Plugin body
     * --------------------------------------------------------------------- */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, COPY), 'peak-reminder: copy');
        const t = ctx.locale.bind(NS);

        ctx.effect(() => {
          void refreshSchedule();
          const timer = setInterval(() => { void refreshSchedule(); }, REMOTE_TTL_MS);
          return () => { clearInterval(timer); };
        }, 'peak-reminder: published schedule');

        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'peak-reminder',
          order: -2,
          locale: NS,
        }, PeakDot));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'peak-reminder.toast',
          order: 40,
          locale: NS,
        }, PeakToast));

        // The Workspace UI owns navigation; a build without it still gets the notice.
        const openSession = sessionId => {
          try {
            const workspace = ctx.get('uiWorkspace');
            if (workspace !== undefined && workspace !== null
              && typeof workspace.openSession === 'function') {
              workspace.openSession(sessionId);
            }
          } catch {
            // Navigation is an offer on top of the notice, never a requirement.
          }
        };

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'peak-reminder.global',
          order: 39,
          locale: NS,
          inject: () => ({ openSession }),
        }, PeakGlobal));

        // The usage cell sits in the sidebar foot, directly above the account row.
        const balanceStore = createStore(undefined);
        let refreshBalance = () => {};

        ctx.inject(['accountUi', 'remote'], scope => {
          let lastRead = 0;
          let inflight = null;
          const read = async () => {
            try {
              const account = scope.accountUi.getSnapshot();
              if (account?.view?.status !== 'credential-stored') {
                balanceStore.set({ status: 'signedOut' });
                return;
              }
              const metadata = scope.accountUi.clientMetadata(scope.locale.getSnapshot().active);
              const result = await scope.remote.account.getBalance(metadata);
              if (result?.ok !== true) {
                balanceStore.set({ status: 'failed' });
                return;
              }
              balanceStore.set(result.value?.status === 'ready' ? result.value : { status: 'failed' });
            } catch {
              balanceStore.set({ status: 'failed' });
            }
          };
          refreshBalance = force => {
            if (inflight !== null) return;
            const current = balanceStore.getSnapshot();
            const retry = current === undefined || current?.status === 'failed';
            const now = Date.now();
            if (!(force === true) && !retry && now - lastRead < 60000) return;
            if (now - lastRead < 3000) return;
            lastRead = now;
            inflight = read().finally(() => { inflight = null; });
          };
          refreshBalance();
        });

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'peak-reminder.usage',
          order: 5,
          locale: NS,
          label: () => t('usage.label'),
          inject: () => ({
            hooks: { balance: balanceStore },
            refreshBalance: force => { refreshBalance(force === true); },
          }),
        }, UsageEntry));
      },
    };
  },
});
