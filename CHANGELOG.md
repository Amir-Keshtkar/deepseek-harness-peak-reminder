# Changelog

All notable changes to this DeepSeek Harness plugin. Versions are the
`version` field in `package.json`.

## 1.9.1 — 2026-11-28

- The usage ring now compares the current credit with the amount in force after
  the most recent top-up, not with the highest number ever seen. Any rise
  re-baselines the ring — even a top-up that stays below an older peak — so the
  ratio always answers "how much of my current charge is left". A 1.9.0
  high-water value is discarded rather than reused, because its semantics were
  different.
- Reading credit is visible while it happens. A balance read in flight shows a
  spinner beside the label and a breathing placeholder instead of the previous
  figure or a premature "Unavailable"; the lifetime Spent row waits for the read
  to settle, so opening the panel no longer flashes a number that is about to
  change.
- The fallback dot in a new chat sits at the same inset as the Session header's
  dot instead of hugging the window edge, so it is comfortably clickable.

## 1.9.0 — 2026-11-28

- The header dot repaints exactly when peak starts or ends. The old twenty-second
  poll could show the previous colour indefinitely on a window whose timers were
  throttled; the status clock now wakes at the boundary (and at the start of the
  amber lead-in), and repaints at once when the window regains focus or the page
  becomes visible.
- The dot is present in a brand-new chat. The Session header hides its utilities
  while the conversation is blank, so a floating copy now sits in the same
  trailing seat until a Session header claims it.
- The sidebar usage control is a full-width row matching the account launcher
  directly below it: same 42px height, padding, radius, and label size. The
  number no longer widens the control, and the row shows the estimated cost
  rather than the token total (the tokens remain in the tooltip and the panel).
- Its bar-chart glyph is replaced by a ring that fills with the share of credit
  spent. The denominator is the highest credit this browser has seen per
  currency, so a top-up raises the ceiling instead of pinning the ring at 100%.
- With no readable balance — the API-key reader, or a refused account call — the
  panel's balance band gains a lifetime "Spent" figure computed from every
  Session's tokens, and a reset button for the moment the account is topped up.
  The book is monotone and persisted, so deleting a chat or collapsing the
  sidebar never lowers it. `tests/panel.test.cjs` covers the band and the ring,
  and `tests/usage.test.cjs` covers the book and the credit ratio.

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
