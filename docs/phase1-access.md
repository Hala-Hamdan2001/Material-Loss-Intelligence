# Phase 1: private workspace access

## Scope
Only workspace memberships, job permissions, assignment, and the UI needed to use
those controls were added. There is no board, export, investigation-status change,
or visual redesign.

## Authorization policy
- Demo stays unauthenticated and keeps its existing operations. Its access context
  has no authenticated user ID and cannot manage memberships or assign private jobs.
- Private access requires an active workspace membership on every request.
- Managers have existing full workspace functionality and can manage members.
  The final active Manager cannot be removed or demoted.
- Workers can create jobs, view jobs they created or are assigned, and edit those
  jobs while they are drafts. Creation identity comes from the server.
- Workers cannot close/reopen jobs, change workspace settings, inspect comparisons
  or dashboards, generate insights, read investigation notes, or change memberships
  or assignments. Their job-level operational weights/balance metrics remain usable.
- Creators retain access to their own jobs even after reassignment. Removing their
  workspace membership revokes all private access.
- Existing job creator/assignee fields remain null; no historical author is inferred.

## Enrollment and switching
Each account signs in once. Settings shows its account ID, which can be shared with
a Manager through an existing trusted channel. Managers enter the known account ID
to add/update membership; no global account directory is exposed. Members can then
select the shared workspace. Membership itself is authority, never the workspace
selection cookie or a role submitted in a request.

Memberships are read per request. Private mutations serialize on the workspace
row and recheck membership under that lock, coordinating revocation, assignment,
and last-Manager checks. UI context is refreshed on focus and every 15 seconds;
scope changes purge cached queries/mutations. Backend checks do not depend on this
polling interval. Previously downloaded data cannot be remotely erased.

## Recovery and migration
Before development schema changes, the clean code history was saved as a Git
bundle and PostgreSQL was dumped in custom format into the private, ignored,
deployment-excluded `.local/recovery/phase1/` directory. The dump was successfully
restored into a separate verification database; it contained 14 jobs and four
demo workspaces. The original application database was not the restore target.

The additive development migration creates memberships and membership-audit tables
and two nullable job foreign keys. It does not change existing numeric fields,
status, notes, timestamps, references, or organization IDs. A development backfill
from verified private owners was checked and executed; there were zero existing
private workspaces, so it inserted zero memberships.

The backup was compared against original rows using counts and JSON checksums
(excluding the two new nullable fields), confirming preserved jobs, organizations,
events, insights, and users immediately after migration. Future test fixtures are
separate; the API regression script cleans up only its generated records.

For recovery, stop writes first, restore the dump into a separate database and
verify it before considering a coordinated code/data rollback. Never blindly
restore over records created after the checkpoint. The local backup is not an
off-site disaster recovery guarantee; the documented platform checkpoint recovery
is an additional option. Backup files may contain sensitive database contents:
do not commit, publish, or present them as downloadable assets.

No production migration or deployment was performed. Development ownership
backfill is not evidence that a published database has been backfilled. Before a
production rollout, inspect actual production ownership and arrange its approved
data migration; do not add automatic startup DDL or assume schema publication
populates memberships.

## Reproducible development checks
- `pnpm run typecheck`
- `pnpm --filter @workspace/material-accounting test`
- Do not run the permission script against the normal app database. It now
  requires an explicit loopback scratch API and a guarded scratch database name.
  The local isolation harness builds on a disposable copy and verifies source
  checksums. See `auth-permissions-audit.md` for current commands and results.

The API suite uses isolated users and session fixtures to exercise the real HTTP
middleware and permissions. It is not a substitute for testing the actual OIDC
redirect flow; a browser test is also required for that flow.

### Verification results
- Ten existing accounting tests passed.
- Seventeen API permission/regression groups passed, including concurrent Manager
  demotion protection, expired sessions, assignment removal, membership revocation,
  forged IDs, cross-workspace denial, and preserved unauthenticated demo operations.
- Full workspace TypeScript checks passed; final frontend checks passed after the
  workspace-switch cache correction.
- A browser journey with isolated database-session fixtures verified enrollment,
  Worker creation and reload, Manager closure, restricted notes/analytics,
  revocation, demo isolation, and Arabic RTL at phone width without overflow.
- A focused browser recheck verified immediate demo/private switching without
  reload and removal of private content after session expiry. The initial delayed
  workspace switch was corrected.
- Actual OIDC login could not be completed: the synthetic identity override was
  unavailable and the provider displayed normal consent. No real credentials,
  login bypass endpoints, or changes to the identity provider were introduced.
- Synthetic private test accounts/records were removed after verification;
  pre-existing records were preserved.

## Limitations
The historical results above are supplemented by `auth-permissions-audit.md`.
Enforcement is application-level, not PostgreSQL row-level security. Someone with
direct database credentials is outside this authorization boundary. Account-ID
enrollment has no invitation acceptance/email workflow. Cookie protection uses
Secure/HttpOnly/SameSite=Lax plus the existing Origin check (malformed origins now
fail closed); requests lacking Origin remain accepted for existing clients.
This is not a full penetration test, and production enforcement is not verified.
