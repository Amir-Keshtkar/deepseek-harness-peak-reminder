# Changelog

All notable changes to this DeepSeek Harness plugin. Versions are the
`version` field in `package.json`.

## 1.8.0 — 2026-11-22

- Fixed the usage panel's balance band, which never left its loading placeholder
  in the running app. The sidebar entry now hands the injected balance snapshot
  and refresh to the button that renders the panel, the account Remote namespace
  is injected before the read, and a lost account stream shows the unavailable
  state instead of loading forever.
- The balance band is one line: a "Balance" label and the credit left, with the
  topped-up and granted wallets added together. The per-wallet breakdown is gone.
- Right-to-left reaches the approval prompt the agent raises before a guarded
  call: the reason, description, subject, status strip, and buttons mirror, so a
  Persian question reads right to left instead of staying in a left-to-right
  card. The tool detail under the question stays left to right, as do code and
  formulas.
- `tests/rtl.test.cjs` pins the promise: every prose surface keeps its RTL
  selector, and every code surface keeps its LTR override. `tests/usage.test.cjs`
  pins the balance plumbing: the hook and the refresh reach the panel.

## 1.7.1 — 2026-11-18

- Reverted the 1.7.0 balance change, which was pushed directly to `main` and did
  not render the charged total.
- The usage panel's balance band now headlines the account total: the topped-up
  and granted wallets added per currency, with both parts named on the line
  below. The amount is read once the account services are ready and again each
  time the panel opens.
- The band now always renders: a placeholder while the first read is in flight,
  and the signed-out or unavailable message when the read cannot return credit,
  so a refused account read is visible instead of silently absent.

## 1.6.0 — 2026-11-17

- Right-to-left text reaches Markdown documents opened from the files panel,
  with code blocks, YAML frontmatter, and formulas kept left to right.

## 1.5.0 — 2026-11-17

- Clicking a desktop notification brings the window forward and opens the
  Session the reply or question belongs to, instead of only focusing the app.
- Published to npm as `deepseek-harness-peak-reminder`; the package name, the
  bundle row, and the client module id now agree.

## 1.4.0 — 2026-11-17

- Repository renamed to `deepseek-harness-peak-reminder`; the plugin id and the
  `schedule.json` location follow it.
- README gains a FAQ written around the questions the tool answers, and the
  install line now uses the canonical repository id.
- `package.json` publishes keywords, author, license, and repository links.
- MIT license added.

## 1.3.0 — 2026-11-17

- Balance band in the usage panel: the account's remaining credit and any
  granted credit, read from the account service when the panel opens, visually
  separated from this session's own numbers.
- Usage cell in the sidebar foot: input, cached and output tokens, decode speed,
  turn count with total model time, model name, and an estimated cost at the
  rate in force.
- Locale dictionaries grow to 44 keys each.

## 1.2.0 — 2026-11-17

- Desktop notification when a reply finishes or the agent asks a question.
- Right-to-left switch for messages, session titles, and multi-choice questions,
  with code and formulas kept left to right. Both switches persist per browser.
- Hoverable and keyboard-focusable peak change points on the 24-hour ribbon.

## 1.1.0 — 2026-11-17

- Schedule corrected to DeepSeek's published windows: 01:00–04:00 and
  06:00–10:00 UTC, Monday to Friday, excluding Chinese public holidays.
- Three-layer self-update: runtime `schedule.json`, the Host half re-reading the
  official pricing page twice a day, and `scripts/sync-schedule.mjs` for CI.
- Plugin copies follow the host language (English, Chinese).

## 1.0.0 — 2026-11-17

- Status dot in the conversation header: red and pulsing during peak, amber in
  the half hour before, green off-peak.
- Countdown card with the local-time windows and a 24-hour ribbon.
