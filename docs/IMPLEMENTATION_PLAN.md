# React modernization

Branch: `feat/react-modernization`. Baseline: `f7ad309` on `main`.

## Repository audit

Read every tracked source and configuration file, plus the pre-ZIP analyzer at
`5d6fe21` and the importer at `2428c6e`. Current app: 375 lines of Streamlit;
guide: 54 lines. The earlier version adds loose JSON imports, Unicode repair,
first-message date and word extraction. Wordcloud was explicitly removed.

Features to retain: Instagram export ZIP (5 GiB), inbox directory / JSON pages,
WhatsApp text exports, owner-name inference and multiple owner aliases, persisted
custom groups across platforms, ranked conversations, last-active dates, full
conversation statistics, message counts, busiest day, longest streak and its
dates, average reply time, daily counts, moving average, sender shares, engagement,
delay score, double texts, session initiations, per-sender median delays, weekday /
hour heatmap, export guide, global Meta AI exclusion, Made by Aaloe footer.

## Implementation sequence

1. Establish React 19, strict TypeScript, Vite, Tailwind and local shadcn/ui
   components. Keep Python only on the original branch; retain no Python runtime
   dependency. Record synthetic Python oracle outputs before retiring old files.
2. Normalize Instagram JSON and WhatsApp iOS/Android text. ZIP central-directory
   traversal and Blob ranges skip media. Parse and calculate in a dedicated worker.
   Store conversation pages in IndexedDB; load only requested conversations.
3. Add a flat charcoal interface with fine borders, lime/blue accents, no background
   gradients. Create import, library, dashboard, detail, groups, identity, storage,
   and guide flows. Use accessible Radix-based shadcn components and local fonts.
4. Integrate modular, lazy-loaded ECharts timeline, heatmap and rings. Virtualize
   conversation and message lists. Add date, sender, source and text filters.
5. Compare TypeScript against outputs from the original Python code, exercise
   imports and persistence in Chromium, run large synthetic and local-archive
   benchmarks. Document formulas, intentional fixes and measured limitations.

## Calculation contract

- Raw total counts include timestamp-less messages; time-based metrics do not.
- Ignore Meta AI before all counts, aliases, groups, search and analysis.
- Original average reply: adjacent different senders, gap 0 through 7 days inclusive.
- A new session starts after strictly more than six hours; first message initiates.
- Original engagement: smallest nonzero displayed sender count / largest × 100.
- Delay score: clamp(100 − average within-session reply delay in minutes, 0, 100).
- Double text score: additional same-sender messages / dated messages × 100.
- Initiation score: sessions / dated messages × 100.
- Per-sender reply median uses different-sender gaps up to seven days.
- Default fixes: replies/sessions stay inside source threads, pending double texts
  flush at session boundaries, daily average uses seven calendar days with zeros.
- An explicit original-calculation mode preserves merged chronology, the original
  session-boundary double-text behavior, and rolling active-day average for parity.
- Custom groups aggregate owner aliases as You, all others as the group name.
  Native group chats support both participant shares and You / others.
- Group totals do not increase the library total. Separate folders with identical
  titles stay separate. Exact reimports replace source pages, never append them.

## Privacy / performance

No backend, analytics, remote fonts, remote images, or message network requests.
All data and derived caches remain in browser IndexedDB. Explicit erase control.
5 GiB per archive; resource limits and partial-import errors are surfaced. Individual
JSON pages are bounded, media is never inflated. Import cancellation retains only
fully committed conversations. Content is rendered as text, never imported HTML.

## Validation

Synthetic fixtures cover score boundaries, six-hour and seven-day thresholds,
missing dates, same-time messages, tied busiest days, trailing streaks, Meta AI,
Unicode, split pages, duplicate titles, WhatsApp multiline and date formats,
cross-platform grouping and owner aliases. Private files are excluded from Git,
reports and fixtures. Benchmark reports contain counts/timings only.
