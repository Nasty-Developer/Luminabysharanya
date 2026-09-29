# Lumina AI

Lumina AI is a browser-only personal productivity companion for tasks, habits, notes, focus sessions, and a local rule-based assistant.

## Run & Operate

- `pnpm --filter @workspace/lumina-ai run dev` — run the Lumina AI web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TypeScript
- Persistence: browser localStorage
- Icons: lucide-react

## Where things live

- `artifacts/lumina-ai/src/App.tsx` — app shell, local state, routes, task/habit/note/focus logic, and Lumina assistant
- `artifacts/lumina-ai/src/index.css` — visual tokens and responsive styling
- `artifacts/lumina-ai/src/components/` — scaffolded shared UI components

## Architecture decisions

- The first build is intentionally frontend-only and requires no API keys, auth, database, or external services.
- All user data is stored in one versioned localStorage record and starts empty for new users.
- Date rollover and daily streaks use Asia/Kolkata so dashboard, habits, and focus totals agree with the user's local day.

## Product

Dashboard, task list, habit tracker, autosaving quick note, focus/break timer, daily progress summary, resettable settings, and a local keyword-based assistant with live app state.

## User preferences

- Keep the product lightweight and browser-only; do not add external AI services or a backend unless explicitly requested.

## Gotchas

- The artifact workflow supplies `PORT` and `BASE_PATH`; use the managed workflow rather than running the root workspace directly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
