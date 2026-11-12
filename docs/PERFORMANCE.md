# Performance measurements

Measured in headless Chromium 158 on this development machine using synthetic data.

| Change | Before → after (median) | Decision |
| --- | --- | --- |
| Batch cloud placement into 6 ms work slices | Desktop: 3,334 → 551 ms; mobile width: 5,001 → 373 ms | Keep |
| Reuse compiled compliment expressions with `exec` | 100,000 messages: 560 → 406 ms | Keep |

Cloud measurements used 100 entries, three runs per width (1100 and 340 pixels).
All entries retained identical coordinates and rendered pixels. Analysis used ten
conversations and an interleaved six-run comparison against the original analyzer;
complete results matched after excluding the processing-time field.

Separate analysis runs varied with machine load, so the interleaved comparison
was used to decide whether to retain the matcher change. These measurements
exclude archive decompression, IndexedDB I/O, and worker message transfers.
They are not field Core Web Vitals measurements. No telemetry was added.

Existing tests were not run, as requested. No test or benchmark tooling is added
to the application. Synthetic investigation artifacts remain ignored under `.local/`.
