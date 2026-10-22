# Next.js mock Business Hub Implementation Plan

> Execution: the user authorized implementation in this session on 22/10/2026. Implement sequentially; no new approval, live credentials, production writes, Telegram messages, or deployment needed.

**Goal:** Build the six existing Business Hub sections in real Next.js/React with editable synthetic data and meaningful regression tests.

**Architecture:** A standalone `nextjs-app/` uses App Router and strict TypeScript. Pure domain functions define calculations/validation/recurrence/backup/report behavior. A client demo repository persists versioned data under a separate localStorage key, with React context managing edits and undo. External actions return explicit mock previews.

**Tech Stack:** Next.js 16.4.2, React, TypeScript, Zod, Chart.js loaded on chart pages, Vitest and Testing Library. Use locally packaged original font families to avoid build-time font downloads.

## Visual contract

Preserve the original CSS token system: navy `#1E2D6F`, deep navy `#162058`, background `#F0F2F8`, ink `#1A1F3A`, gold `#F59E0B`, green `#10B981`. Preserve Be Vietnam Pro for UI and Fira Code for amounts, compact topbar, 220px desktop sidebar, mobile bottom navigation, KPI cards, kanban and edit dialogs. Reuse the original stylesheet as the baseline; add responsive/form/accessibility rules without redesigning it. Preserve existing emoji navigation icons per the user's explicit visual-parity request.

## Tasks

1. **Scaffold and dependencies.** Create `nextjs-app/package.json`, `tsconfig.json`, `next.config.ts`, ESLint/Vitest config, `app/layout.tsx` and `.env.example`; extend root ignore patterns for nested build output/env files. Install packages and retain lockfile. No Firebase/Telegram secrets are copied into the demo.
2. **Domain regression tests first.** Create `tests/domain.test.ts` for Vietnam midnight/month boundaries, amount validation, legacy transaction records, debt windows/paid amounts, completed todo exclusions, report calculations, deterministic recurrence and backup validation/merge. Run tests to observe missing implementation, then implement `lib/types.ts`, `lib/domain.ts`, `lib/demo.ts` and `lib/mock-ai.ts`.
3. **Data and common UI.** Create `components/demo-provider.tsx`, `ui.tsx`, `shell.tsx`, typed record editor, confirmation dialogs and global search. Include demo persistence/reset, undo and mock session transitions. Modal labels/focus/Escape and visible keyboard focus are required.
4. **Six sections.** Implement dashboard, sale, accounting, debts, operations and reports as route pages/components. All displayed actions must work: filters, month navigation, CRUD, progress, paid rent, recurring schedules, customer detail, script copying, chart/report printing and AI mock previews. Implement browser speech recognition with cleanup plus a typed transcript fallback using a deterministic mock parser.
5. **Settings and backup.** Keep AI model/key UI (demo keys only; no real service calls), JSON export/import with preview, legacy v1/v2/v3 support, and daily Telegram report preview at 07:00 Asia/Ho_Chi_Minh. Report generation materializes due recurrence before summarizing. No live scheduler is enabled.
6. **Interaction tests.** Create `tests/ui.test.tsx` exercising provider persistence, CRUD validation, deletion/undo, filtering, recurrence/rent state and report preview. Test actual components with jsdom and mocked browser APIs.
7. **Validation.** Run `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`; launch production server and verify HTTP responses for all routes. Use connected browser if available, otherwise explicitly record missing visual/E2E verification. Re-run existing 22 legacy regression tests to prove the original version remains intact.
8. **Handoff.** Create `nextjs-app/README.md` with commands, demo behavior, feature parity matrix, tests and remaining live integration steps; update design status. No commits or deployments are made.

## Commands

From `nextjs-app/`: `npm.cmd run dev` (http://localhost:3000), `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd start`.

## Decisions already authorized

Keep the existing interface and current active functions, mock all external services, reuse Firebase only in a future live integration, preserve all legacy files, and include a Telegram daily preview covering today's tasks, overdue tasks, debts due today through six days later, and current-month income/expense/net.
