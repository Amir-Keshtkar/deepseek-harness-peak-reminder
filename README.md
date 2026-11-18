# Peak Reminder

[![npm version](https://img.shields.io/npm/v/deepseek-harness-peak-reminder.svg)](https://www.npmjs.com/package/deepseek-harness-peak-reminder)

**A DeepSeek Harness plugin for DeepSeek API peak hours.** A live price-window clock sits in the conversation header, next to desktop notifications, this session's token usage and estimated cost, the account's remaining balance, and a right-to-left switch for Persian and Arabic text.

![The three status states beside the countdown card](docs/preview.svg)

Works with the DSH plugin system: install it once, and the peak schedule keeps itself current from DeepSeek's own documentation.

## What it does

**Peak status.** A small dot sits in the conversation header and reports DeepSeek's billing window.

| State | Dot | Meaning |
|---|---|---|
| Peak | red, pulsing | inside a peak window |
| Soon | amber, ringed | less than 30 minutes until a peak starts |
| Off-peak | green, steady | everything else, including weekends and Chinese public holidays |

Click it for a card with the countdown to the next change, a 24-hour ribbon of the current local day, and the peak windows in your own time zone. The four points where peak flips are hoverable — and focusable by keyboard — to name the exact time of each change. A one-shot toast announces the moment a peak begins.

**Notifications.** A desktop notification arrives when a reply finishes or when the agent asks a question, so you can work elsewhere while DeepSeek runs. The window is left alone while it has focus, where the conversation already shows the result.

**Usage.** A compact cell sits in the sidebar foot, directly above the account row, showing this session's token total and estimated cost. Click it for the input, cached, and output buckets, decode speed, turn count with total model time, the model when the session reports one, and the basis of the estimate. Below them, in its own tinted band so it never reads as a session metric, is the account's remaining balance — with granted credit on a second line when there is any — read from the account service each time the panel opens. Cost comes from DeepSeek's published per-million rates, doubled inside a peak window; it is an estimate, not a bill.

**Right-to-left text.** Answers, the questions you write, the session-list titles, the agent's multi-choice questions with their options, and Markdown files opened from the files panel all read right to left. Code blocks, YAML frontmatter, and formulas stay left to right. All three switches live in the card and are remembered per browser.

## Install

Install from GitHub — the repository root is the plugin package:

```
Plugins → Add plugin → github:Amir-Keshtkar/deepseek-harness-peak-reminder
```

The same identifier works from a shell:

```
plugin_manager install_bundle: github:Amir-Keshtkar/deepseek-harness-peak-reminder
```

The old `github:Amir-Keshtkar/PeakReminder` id still resolves through GitHub's rename redirect, but the new one is the canonical spelling.

It is also on npm as [deepseek-harness-peak-reminder](https://www.npmjs.com/package/deepseek-harness-peak-reminder), for a versioned install that no clone can drift from:

```
plugin_manager install_bundle: deepseek-harness-peak-reminder
```

For development, point the installer at the working copy instead and the running app picks up edits:

```
plugin_manager install_bundle: C:\Users\Amiri\Documents\VS Code\PeakReminder
```

Restart DeepSeek Harness after the first install so the Host half loads.

## Keeping the schedule current

DeepSeek publishes no pricing API, and the docs site sends no CORS headers, so the schedule cannot simply be fetched from the browser's page. Three layers handle it, and every one of them degrades to the next without breaking the display:

1. **`schedule.json` in this repository** is fetched by the plugin at load (with a six-hour cache). It is served by `raw.githubusercontent.com`, which does allow cross-origin reads, so a GitHub-installed copy follows the schedule without being reinstalled. The response is validated — two usable, non-overlapping windows inside one day — and anything else is ignored.
2. **The Host half** re-reads the official page at activation and every twelve hours and rewrites `client.js` and `schedule.json` when the windows changed. This is what keeps a linked working copy current. A packed install is not writable, so it relies on layer 1.
3. **`scripts/sync-schedule.mjs`** does the same work from a terminal, for CI or a cron:

   ```
   npm run sync                             # update client.js and schedule.json
   node scripts/sync-schedule.mjs --check   # report drift; exit 1 when stale
   ```

The parser reads the exact sentence the official page uses — `Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday, excluding Chinese public holidays.` — in English or Chinese, and refuses to write anything it cannot parse. A change to the *rule* itself (weekdays, holiday exclusion) is reported as a warning rather than silently adopted, because the code, not the page, implements it.

## Configuration

The schedule and the amber lead-in are three constants at the top of `client.js`:

```js
const PEAK_WINDOWS_UTC_MINUTES = [[60, 240], [360, 600]]; // 01:00–04:00, 06:00–10:00 UTC
const LEAD_MINUTES = 30;                                  // when the dot turns amber
const CHINA_HOLIDAY_RANGES = [['2026-01-01', '2026-01-03'], /* … */];
```

`CHINA_HOLIDAY_RANGES` holds the State Council's 2026 holiday dates. Add the next year's dates when they are published; until then those days are treated as ordinary weekdays. Holidays are the one part of the schedule that no official machine-readable source provides, so this list is maintained by hand.

The two switches in the card (RTL text, notifications) persist in `localStorage`.

## Tests

No browser is required:

```
node --check client.js
node --check index.js
node --check scripts/sync-schedule.mjs

TZ=Asia/Tehran node tests/time-model.test.cjs   # 16 boundary cases, ribbon, hover points
TZ=Asia/Tehran node tests/locales.test.cjs      # dictionary parity, manifest, input validation
node tests/usage.test.cjs                       # price table, cost estimate, formatters
node scripts/sync-schedule.mjs --check          # the repo matches the official page
```

`time-model.test.cjs` slices the time model out of `client.js` and runs it, so the assertions cannot drift from the shipped code.

## FAQ

**How do I see DeepSeek API peak hours?**
The dot in the conversation header is the answer: red means a peak window is open right now, amber means one starts within thirty minutes, green means off-peak. Click it for the countdown to the next switch and the windows converted to your own time zone.

**When are DeepSeek's peak hours, exactly?**
01:00–04:00 and 06:00–10:00 UTC, Monday through Friday, excluding Chinese public holidays. That is 04:30–07:30 and 09:30–13:30 in Tehran. Every other hour is off-peak and billed at the lower rate.

**Does it update when DeepSeek changes the schedule?**
Yes, on its own. The schedule is parsed from the official pricing page and published as `schedule.json`, which the plugin re-reads at load; the Host half also re-reads the official page twice a day. Nothing needs reinstalling and no setting has to be touched. See [Keeping the schedule current](#keeping-the-schedule-current).

**Is there a DeepSeek off-peak reminder?**
The same dot covers both directions: it counts down to the off-peak window opening as well, and a toast marks the moment a peak begins, so a long job can be started after the switch instead of before it.

**Does it work with Persian and RTL text?**
Yes. One switch in the card turns answers, your own messages, session titles, and the agent's multi-choice questions and options right to left, while code blocks and formulas stay left to right. The plugin's own labels follow the app language — English by default, Chinese when the app runs in Chinese.

**Why is the cost an estimate?**
DSH reports tokens, not money. The plugin multiplies the tokens of the current session by DeepSeek's published per-million rates, doubling them inside a peak window. A session that spans a peak boundary is priced at the rate in force when the panel is opened, so treat the figure as a size, not a bill — the account's real remaining balance is shown below it.

**Does it read my conversations?**
No. It reads token counters the app already publishes and renders text it was given. The only outbound requests are the official pricing page, from the Host half, and `schedule.json`, from the browser.

**Which DeepSeek models are priced?**
`deepseek-flash` and `deepseek-v4-pro`, each with a cache-hit rate for cached input. The table ships with the plugin as a constant in `client.js`.

## Limitations

- Notifications are suppressed while the window has focus.
- Clicking a notification opens the Session it announced, when the Workspace UI is present.
- The RTL selectors match attribute hooks and CSS-module local names; a rename upstream would narrow them, not break rendering.
- The usage cost is an estimate at the rate in force when the panel is read: a session that spans a peak boundary is not split between the two rates. The price table is shipped with the plugin.
- The usage cell is hidden while the sidebar is collapsed, because the whole sidebar foot is hidden on this desktop build.
- The balance band needs a signed-in account and a permitted account read; otherwise it says so instead of guessing.
- Chinese holiday dates are a maintained list, as noted above.

## Layout

| File | Role |
|---|---|
| `client.js` | the dot, the card, the toast, notifications, RTL, and the time model |
| `index.js` | Host half; refreshes the schedule from the official page |
| `schedule.json` | the published windows the plugin fetches at runtime |
| `scripts/sync-schedule.mjs` | the same refresh, for a terminal or a cron |
| `cordis.patch.yml` | the plugin row in the profile |
| `locale/en.json`, `locale/zh.json` | display metadata for the Plugin Manager |
| `docs/preview.svg` | the single image on the plugin's detail page |
| `docs/social-preview.png` | the 1280×640 card GitHub shows when the repository is shared |
| `CHANGELOG.md`, `LICENSE` | release history and the MIT license |

The plugin reads no session content; the only outbound requests are the official pricing page (Host) and `schedule.json` (browser).

## License

MIT — see [LICENSE](LICENSE).
