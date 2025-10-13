# Repository Guidelines

## Project Structure & Module Organization
The App Router lives in `app/` with audience-specific folders (`(auth)`, `(owner)`, `(public-booking)`), plus shared layout shells. Shared UI sits in `components/` (theme tokens in `components.json`); domain logic and integrations stay in `lib/` and `helpers/`. Prisma access is centralized in `db/index.ts`, with schema and seeds under `prisma/`. Shared hooks reside in `hooks/`, cross-cutting types in `types/`, static assets in `public/`, and deeper design notes in `docs/`. Add new features beside the route or service they extend.

## Build, Test, and Development Commands
- `npm run dev` spins up Next.js for local work; watch the public booking flow live.
- `npm run build` pushes the schema via Prisma, regenerates the client, and bundles for production.
- `npm run start` serves the compiled app for pre-release smoke checks.
- `npm run lint` enforces the flat ESLint/TypeScript rules.
- `npx prisma migrate dev --name <change>` records schema updates; follow with `npx prisma db seed` when fixtures change.

## Coding Style & Naming Conventions
Write TypeScript with 2-space indentation and match import order from existing files. Use `kebab-case` for React components and file names, `useCamelCase` for hooks, and `camelCase` for helpers. Keep shared types and zod schemas in `types/`. Prefer Tailwind utility classes; limit global overrides to `app/globals.css`. Run `npm run lint` before every commit.

## Testing Guidelines
No automated suite exists yet, so list manual verification steps in each PR and exercise the owner dashboards plus public booking while `npm run dev` is running. New tests should live next to their feature (`FeatureName.test.tsx`) and mock Prisma through `db/index.ts` so they stay hermetic. Prioritize coverage for booking availability and Stripe flows when a runner is introduced.

## Environment & Configuration
Copy `.env.example` to `.env`, add `DATABASE_URL`, and fill Stripe plus Resend keys. Align `NEXT_PUBLIC_APP_URL` with your local host. After env or schema changes, run `npx prisma db push` (or `migrate dev`) and reseed if data contracts change. Never commit populated env files.

## Commit & Pull Request Guidelines
Keep Conventional Commits (`feat:`, `fix:`) with clear scopes (`feat: owner capacity`). PRs need a concise summary, linked issue, screenshots for UI changes, and notes on schema/env impacts. Request review only after lint passes, migrations are checked in, and manual checks are documented. Use descriptive branch names such as `feature/tenant-switcher`.
