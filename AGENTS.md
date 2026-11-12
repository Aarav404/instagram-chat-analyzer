# Repository Guidelines

## Project Structure & Module Organization

`src/App.tsx` coordinates the aaloe-lyzer React application. Keep parsing and calculations in `src/core/`, Instagram and WhatsApp readers in `src/core/parsers/`, and import and IndexedDB persistence in `src/data/`. Heavy analysis runs through `src/workers/analysis.worker.ts`.

UI components live in `src/components/`; interactive ECharts visualizations belong in `src/components/charts/`, and shared UI primitives in `src/components/ui/`. Shared styles are in `src/styles.css`, static assets in `public/`, and architecture notes in `docs/IMPLEMENTATION_PLAN.md`.

## Build, Test, and Development Commands

Use Node.js 22.12 or newer and install dependencies with `npm ci`.

- `npm run dev`: start Vite at the address printed in the terminal.
- `npm run check`: run TypeScript checks.
- `npm run build`: check types and create the production bundle in `dist/`.
- `npm run preview`: serve the production bundle for review.
- `npm test`: run Vitest unit and calculation tests.
- `npm run test:browser`: run Playwright desktop and mobile checks; build first and install Chromium with `npx playwright install chromium`.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and the existing minimal-semicolon style. Name React components in PascalCase, hooks with `use`, and core modules with descriptive kebab-case filenames. Prefer shared types from `src/core/types.ts` and `@/` imports within application code. No dedicated formatter or linter is configured; match surrounding code.

## Testing Guidelines

Name unit tests `tests/*.test.ts` and browser tests `tests/browser/*.pw.ts`. Use synthetic chats rather than personal exports. Calculation tests compare legacy behavior with `tests/legacy-golden.json`; document intentional formula changes. No numerical coverage threshold is configured. Respect explicit requests to skip test execution and report any unverified behavior.

## Commit & Pull Request Guidelines

Recent commits use `feat:`, `fix:`, and `chore:` prefixes; follow that convention with concise descriptions. PRs should explain the user-visible change, relevant calculation or parsing decisions, and validation performed. Link applicable issues and include screenshots for visual changes.

## Privacy & Architecture

Keep messages and analysis in the browser. Never commit or deploy chat exports, `inbox/`, `messages/`, credentials, or personal fixtures. Preserve import deduplication and account grouping. Avoid expensive parsing on the UI thread. Python is only relevant to the optional historical validation script, not the application runtime.
