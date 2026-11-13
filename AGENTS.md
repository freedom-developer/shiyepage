# Repository Guidelines

## Project Structure

This npm workspace has a Vue 3/Vite app in `frontend/` (pages in `src/views/`, components in `src/components/`, shared logic in `src/lib/`, assets in `public/`) and a Fastify API in `backend/` (`src/`, Prisma schema in `prisma/`, tests in `tests/`). The root package coordinates commands. Do not commit runtime databases, uploaded files, or kernel source.

## Build, Test, and Development

Run commands from the repository root unless noted:

- `npm install` installs both workspace dependencies.
- `npm run db:setup` generates Prisma Client, initializes the local database, and seeds it.
- `npm run dev` starts frontend and backend together; use `npm run dev:frontend` or `npm run dev:backend` to run one workspace.
- `npm run typecheck` checks both workspaces; `npm run build` builds backend and frontend.
- `npm test --workspace backend` runs backend tests using Node's test runner through `tsx`.

The frontend has no separate test or lint script currently. Run `npm run build` to include its Vue/TypeScript checks.

## Coding Style

Use TypeScript and follow nearby patterns: two-space indentation, semicolons, and single quotes where consistent with the file. Use PascalCase for Vue component filenames, camelCase for functions and variables, and kebab-case for route paths. Keep validation and authorization in the backend; reuse frontend API helpers. No formatter or linter is configured.

## Testing Guidelines

Backend tests are in `backend/tests/` and use `*.test.ts` names. Add or update tests for API behavior, access control, and data changes. Tests use temporary databases and storage; do not point them at personal or production data. Run the backend test command and `npm run typecheck` before submitting.

## Commits and Pull Requests

The short Git history (`update`, `Initial commit`) establishes no convention. Prefer imperative subjects such as `Add public PDF access test`. Pull requests should summarize changes, list verification commands, link related issues, and include screenshots for UI changes.

## Security and Configuration

Use `backend/.env.example` as the local configuration template. Never commit `.env` files, JWT secrets, database files, private PDFs, or source indexes. Change default credentials and secrets before deployment, and preserve the API's authorization checks for private resources.
