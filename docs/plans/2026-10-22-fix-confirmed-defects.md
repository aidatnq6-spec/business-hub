# Business Hub defect fixes Implementation Plan

> Execution: implement the approved fixes directly in this session.

**Goal:** Fix the defects confirmed during the source review without changing the active product's feature set.

**Architecture:** Keep the existing vanilla JavaScript/Firebase application. Treat `public/index.html` as the deployment source and mirror it to root `index.html`; preserve version archives. Use Firestore transactions for recurring task deduplication and cloud rent payment state.

**Tech Stack:** HTML, JavaScript ES modules, Firebase Auth/Firestore 10.12, Node built-in test runner.

## Tasks

1. Add `tests/business-hub.test.cjs`: run the actual inline application code in an isolated VM with mocked Firebase/DOM; reproduce recurring task crashes, missing global handlers, voice form contamination, unsafe rendering, date and report errors, and restore behavior. Run `node --test tests/business-hub.test.cjs` before changes.
2. Fix recurrence rendering and creation in `public/index.html`: bind the row button directly, use a deterministic daily execution marker and todo ID in one transaction, record success only after commit, and permit retry after failures. Fix module-scope event handlers and sorting fallbacks.
3. Fix voice recognition lifecycle, reset both amount fields, validate AI output, render previews as text, and use Vietnam business dates. Validate transaction/debt amounts before writes. Correct negative-base report comparison.
4. Store rent payment status in `rentPayments`, subscribe to it, and migrate existing local positive statuses once per owner without overwriting newer cloud records. Include all business collections in backup. Validate import fully before writes, preserve timestamps, and explicitly describe import as merge/upsert without deleting other data.
5. Escape untrusted text at HTML sinks, keep JavaScript arguments separately encoded, validate external links/images, and remove HTML insertion from chat messages. Add an API timeout. Ignore the local secret file in Git. Update deploy scripts to handle errors and deploy configured Firestore rules with hosting.
6. Restrict service-worker caching/fallback to same-origin application navigation and shell assets; cache required CDN scripts and use a new cache version. Keep background notifications outside scope; reminders run while the app is open.
7. Run regression tests, syntax checks, JSON parsing and module/global handler checks; synchronize root HTML, and document findings and remaining live-service verification limits in `docs/code-review-2026-10-22.md`.

No live account operations, production writes, key rotation, or deployment are part of this local fix. Historical `v4`–`v6` syntax errors remain in archived versions and are documented rather than rewriting snapshots.
