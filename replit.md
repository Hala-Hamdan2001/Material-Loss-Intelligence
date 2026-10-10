# Material Loss Intelligence

Bilingual English/Arabic production-job accounting: record material outcomes, validate balance, close jobs, compare scrap, and support investigations.

## Run & Operate

- Managed workflows: `artifacts/api-server: API Server` and `artifacts/material-loss: web`.
- `pnpm --filter @workspace/material-accounting test` — deterministic accounting tests.
- `node scripts/test-material-api.mjs` — API checks through the running shared proxy, using an isolated synthetic demo workspace.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/material-loss`: React interface and translation resources.
- `artifacts/api-server`: authentication, workspace ownership, job APIs, and constrained insights.
- `lib/material-accounting`: shared calculations, closure validation, historical comparisons, and aggregates.
- `lib/api-spec/openapi.yaml`: contract for generated clients and validators.
- `lib/db`: PostgreSQL schemas.

## Architecture decisions

- All weights are kilograms with at most three decimal places; calculations balance integer grams to avoid tolerance-edge rounding errors.
- Demo browsers receive isolated synthetic workspaces without sign-in. Private workspaces require active workspace-scoped Manager/Worker membership; demo access never establishes identity.
- AI selects permitted investigation prompts. Numeric narrative is rendered from validated evidence, preventing invented metrics or unsupported causes.
- A closed job retains its closure tolerance even if workspace settings later change.

## Product

- Dashboard, job search/filters, draft entry/editing, validated closure, reason-required reopening, investigation notes, direct comparison, and minimum-history baseline.
- Demo jobs IK-202 and IK-203 reproduce the pilot figures. IK-204 is intentionally unbalanced. Demo dates and material/product names are synthetic.
- Private workspaces start empty. Machines, materials, and products are free-entry values with suggestions from prior jobs.

## User preferences

- Arabic/English and RTL/LTR are first-class MVP requirements, including all error states and insights.
- Preserve user-entered content when switching language.
- Core workflow must remain usable on phones and tablets without horizontal page overflow.
- Scrap is waste; reusable offcuts and rework are separate outcomes, never scrap.
- Do not expand into ERP, cutting optimization, offcut inventory, billing, machine integrations, or advanced roles.
- Preserve the existing unauthenticated demo and its data/functionality when adding private access controls. Do not merge demo records into private workspaces.
- Accounting status and investigation status must stay independent; investigation must never change calculation, closure-validation, or dashboard metric rules.
- Before each enhancement phase, verify recoverable code and database state. Run its regression and permission tests before proceeding; stop and explain architectural conflicts before risky changes.

## Gotchas

- Do not add runtime schema creation. Update Drizzle schemas and apply changes to the development database.
- Run API codegen after contract changes. The Zod output deliberately omits duplicate TypeScript schema generation to avoid path/query type-name collisions.
- Public demo data is not suitable for confidential records; use a signed-in private workspace.
- Presentation mode is a separate browser-local demonstration, never a real role override or impersonation feature. Keep it free of business/auth API calls and private workspace data.
- See `docs/presentation.md` for the synthetic presentation script, storage limits, and read-only/no-database test commands.
- See `docs/phase1-access.md` for enrollment, permission scope, recovery evidence, migration notes, reproducible tests, and limitations.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
