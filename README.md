# Peak Reminder

A DeepSeek Harness plugin that shows DeepSeek's API price window in the conversation header.

| State | Colour | Meaning |
|---|---|---|
| Peak | red, pulsing | inside a peak window |
| Soon | amber, slow pulse | less than 30 minutes until a peak starts |
| Off-peak | green, steady | everything else, including weekends and Chinese public holidays |

DeepSeek's published schedule: peak is **Monday to Friday, 01:00–04:00 and 06:00–10:00 UTC** (09:00–12:00 and 14:00–18:00 Beijing time), excluding Chinese statutory holidays; every other hour is billed at half price. In Tehran that is 04:30–07:30 and 09:30–13:30 on weekdays.

Click the dot to open a card with the countdown to the next change, a 24-hour ribbon for the current local day, and the peak windows in local time. A one-shot toast announces the moment a peak begins.

The plugin draws its copy from the Harness locale service, so it follows the application's language setting instead of the browser's: English is the baseline dictionary, Chinese (`locale/zh.json`) is shipped, and any other language falls back to English.

## Keeping the schedule current

DeepSeek publishes no pricing API, and the docs site sends no CORS headers, so the browser cannot read it directly. Instead:

- The **Host half** reads the official pricing page's markdown at activation and again every twelve hours. When the peak windows in that sentence differ from the ones in `client.js`, it rewrites the constant in place (through a temporary file) and logs one line. Offline or unparsable pages change nothing.
- **`scripts/sync-schedule.mjs`** does the same thing from a terminal:

  ```
  npm run sync              # update client.js from the official page
  node scripts/sync-schedule.mjs --check   # report drift, exit 1 when stale
  ```

The parser reads the exact sentence the page uses — `Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday, excluding Chinese public holidays.` — in English or Chinese, and refuses to write if that sentence disappears. A change to the *rule* (weekdays, holiday exclusion) is reported as a warning rather than silently adopted, because the code, not the page, implements it.

`CHINA_HOLIDAY_RANGES` holds the State Council's 2026 holiday dates. Add the next year's dates when they are published; until then those days are treated as ordinary weekdays.

## Install

Use **Plugins → Add plugin** and pick this directory, or:

```
plugin_manager install_bundle: C:\Users\Amiri\Documents\VS Code\PeakReminder
```

An automatic rewrite only works for a linked local install; a packed install inside `node_modules` is not writable, so run `npm run sync` there instead.

## Layout

| File | Role |
|---|---|
| `client.js` | all UI and time logic: the dot, the card, the toast, the schedule constants |
| `index.js` | Host half; refreshes the schedule from the official page |
| `scripts/sync-schedule.mjs` | the same refresh, for a terminal or a cron |
| `cordis.patch.yml` | the plugin row in the profile |
| `locale/en.json`, `locale/zh.json` | display title and description for the Plugin Manager |
| `docs/preview.svg` | the single image on the plugin's detail page |

The plugin reads no session data; the only outbound request is the schedule page itself.
