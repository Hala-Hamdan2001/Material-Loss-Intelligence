# Authentication and permissions audit — 2026-10-10

## Scope and readiness

Existing React/Vite frontend, Express API, PostgreSQL/Drizzle schema and Replit
OIDC sessions were reviewed. No UI/chart changes, new roles, schema changes,
production operations, invitation feature, workflow board or CSV export.

| Readiness question | Evidence / conclusion |
| --- | --- |
| Permission logic tested? | Yes, 22 HTTP integration groups against disposable PostgreSQL using synthetic session fixtures through real middleware. Not real login. |
| Real authentication verified? | Partially: deployed development login-start returned 302 to replit.com, S256 PKCE, state, nonce, /api/callback and Secure/HttpOnly cookies. Consent, callback completion, successful refresh and provider logout were not exercised. |
| Real Manager/Worker multi-user workflow verified? | No. Fixture-based workflow verified; a second consenting real registered account is still needed for real Worker sign-in. |
| Production ready? | Not established. Production schema/backfill, identity-provider callback URLs, proxy-header trust and provider lifecycle behavior remain unverified. No production database was accessed or migrated. |

## Confirmed enforcement

- Public Demo uses its own cookie-derived workspace; its context has no user ID.
  Shared page URLs are not inherently private: private selection requires a valid
  server session and active membership. Anonymous `/auth/user` returns null by design.
- Private identity comes from opaque PostgreSQL sessions. Membership and role are
  loaded server-side, not accepted from payloads or workspace-selection cookies.
- Worker reads are scoped to created or assigned jobs. Edits require visible drafts
  and the current revision. Historical creator-null jobs require assignment.
  Creators intentionally retain access after reassignment, provided membership
  remains active. This matches the existing policy.
- Worker API calls cannot get dashboard analytics/comparisons, write investigation
  notes, generate insights, update settings, manage members, assign, close or reopen
  jobs. Read payloads exclude investigation notes and management signals.
  Workers may view their account/settings page; it does not grant settings writes.
- Job IDs and workspace IDs do not grant access. Foreign lifecycle, notes,
  assignment, comparison and insight requests were denied. Foreign workspace
  cookies were rejected for list/dashboard/reference/member/settings operations.
- Create AND update payloads cannot change server-owned creator, assignee,
  workspace, role or accounting status. Stale writes, closed edits, foreign
  assignees and removed assignments were denied.
- Membership and assignment writes serialize on the workspace row, with membership
  rechecked under lock. Last-Manager demotion/removal is denied; concurrent mixed
  removal/demotion retained one active Manager.
- Deleted, invalid, database-expired and access-token-expired-without-refresh
  sessions were denied. Role changes/revocation affected subsequent API requests.
- Cookie and Bearer session paths, hostile/malformed Origin rejection, unchanged
  Demo CRUD/validation/date filters and IK-202/IK-203 calculations were checked.
- No export endpoint currently exists; there is no export permission to certify.

## Confirmed fixes and tests

1. **Local logout depended on provider availability.** Session deletion now happens
   before discovery; if provider logout fails, the app returns locally after
   invalidation. Scratch API deliberately used an unreachable issuer. HTTP tests
   confirmed redirect, deleted session row, and denial when replaying the old token.
   This does not mean the user's Replit provider session was logged out.
2. **Return-path validation accepted browser-normalized external paths.** Shared
   validation rejects backslashes, control characters and non-local paths.
   Fifteen unit cases plus the logout HTTP regression passed.
3. **Callback hardening:** missing nonce now rejects before discovery/token exchange,
   alongside the existing state/verifier requirement. Negative HTTP test passed.
   Valid nonce/state/PKCE cryptographic checks remain delegated to openid-client.
4. **Test safety:** permission tests now refuse an unguarded database name or an
   implicit/non-loopback API. They no longer default to the normal development API.

Files: `artifacts/api-server/src/routes/auth.ts`,
`src/lib/auth-return.ts`, `src/tests/auth-return.test.ts`,
`src/tests/permissions.test.ts` (last three relative to the API server).
The existing ignored `.local/recovery/phase-a-harness.sh` gained a run-tests-and-exit
option. Documentation: this report and `phase1-access.md`.

## Verification executed

- 22 permission/regression groups passed in the final run.
- 15 return-path cases and 10 existing accounting tests passed.
- Full workspace TypeScript checks, API build and frontend production build passed.
  Existing non-blocking frontend sourcemap/chunk-size warnings remain.
- Scratch database/server/dump/fixtures were cleaned. All eight original public
  table counts/checksums matched after the final isolated run.
- Managed API restarted and served requests; real development login initiation
  passed the limited read-only probe described above.
- Prior isolated browser evidence covers workspace-switch cache clearing, membership
  revocation and expired-session screens. Those browser journeys were **not rerun**
  in this audit; frontend cache logic was inspected and unchanged.

Local rerun (not a production command; harness is ignored local tooling):

```sh
pnpm --filter @workspace/api-server build
RUN_PERMISSION_TESTS=1 ISSUER_URL=http://127.0.0.1:9 bash .local/recovery/phase-a-harness.sh
pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/tests/auth-return.test.ts
pnpm --filter @workspace/material-accounting test
pnpm run typecheck
PORT=18160 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/material-loss build
```

The unreachable issuer applies only to the temporary test process, not workspace
configuration. There is no fake login provider or app authentication bypass.

## Limits and onboarding

- Real factory onboarding currently requires each person to log in once, share
  their own account ID via a trusted channel, and be added by a Manager in Settings.
  The registered account can then select the shared workspace. No public account
  directory, invitation delivery, expiring invitation or acceptance flow exists.
  For a supervised pilot, retain known-ID enrollment; an invite/acceptance flow is
  a separate future change, not necessary to fake for a presentation.
- Authorization is application-level, not database row-level security.
- Provider-side token/account revocation is not immediately introspected. Local
  session deletion is enforced on subsequent requests; already-started requests
  and previously downloaded content cannot be retroactively recalled.
- Workspace/role UI polling is every 15 seconds in active tabs and on focus.
  Offline/suspended tabs can retain previously rendered data. Assignment-only
  changes do not change the workspace key; an open draft can remain visible until
  a job refetch or rejected save. This is not continuing backend authorization.
- Origin checks accept missing Origin for existing clients and rely on deployment
  proxy headers. Local logout remains a GET (possible nuisance forced logout).
  No full penetration test, exhaustive race proof or production proxy test occurred.
- Successful provider refresh, consent denial, signed-token rejection cases and
  provider end-session behavior remain unverified, not implicitly passing.

## Manual checklist without changing business records

Use the standalone app preview rather than the embedded frame if provider navigation
is blocked. Authentication creates/updates session and user metadata; the following
does not require editing jobs, settings or memberships.

1. In your usual browser/profile, open the app. Use the workspace menu → Log in.
   Complete the genuine Replit login/consent with your existing account.
2. Confirm return to the app. Open `/api/auth/user` on the same app origin: it should
   show your account, not null. Do not share cookies, tokens or the full response.
3. Select your **existing** private workspace. Confirm Manager status and read-only
   dashboard/jobs access. Do not create another workspace or edit/save any record.
4. Switch Demo → existing private → Demo. Check that job lists and filters match
   the selected workspace and private content disappears on switching. Confirm
   the Demo still has IK-202/IK-203. Do not modify Demo records.
5. Log out using the app. Open `/api/auth/user` again: expect null. Use browser Back
   and then reload; private data must not reload. Check recovery offers sign-in or
   Demo, not private access. A browser history image alone is not a successful API read.
6. Open an incognito window, without login. Confirm public Demo works. A known
   private job URL must not return its private record (it will be looked up within
   Demo and show not-found). Fresh Demo sessions can automatically seed a separate
   Demo workspace; use the existing browser's Demo if avoiding even that is required.

These steps cannot verify real Worker login, membership revocation or last-Manager
mutations without another identity and/or membership writes. Do not demote your
only Manager. Keep the isolated automated evidence for now; later use two real,
consenting accounts in a dedicated empty test workspace for the full identity-to-role
journey. Production verification requires its own approved read-only inspection
and, only if needed, a separately approved migration.
