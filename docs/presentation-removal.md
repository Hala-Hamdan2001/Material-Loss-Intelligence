# Presentation removal regression gate

Presentation mode is retired. Its entry-point branch, menu entry, local components,
synthetic storage/actions, dedicated tests, and guide were removed. The normal
application's shared job-form core and formatting utilities were retained.

The retired `/presentation` path and its nested paths now render the normal
not-found page. Old presentation session storage is inert and is not read or
cleared; no blanket browser storage or cookie cleanup was introduced.

## Phase A checks actually run

- Full workspace TypeScript checks passed.
- All 10 shared accounting tests passed, including IK-202/IK-203.
- Production frontend build passed with its required PORT and BASE_PATH values.
  It emitted non-blocking source-map and bundle-size warnings.
- All 17 existing API permission/regression groups passed against a restored,
  isolated scratch database and temporary API, not the original database.
- Browser tests routed application API traffic exclusively to that scratch API.
  They verified Demo totals and comparison, date filtering, draft validation,
  valid closure, notes, Settings, Arabic mobile layout, Manager workspace
  switching, Worker draft entry and restricted controls, cross-workspace denial,
  and access removal after membership revocation.
- The retired routes rendered ordinary not-found views, the menu entry was
  absent, and an old presentation-storage sentinel remained untouched.
- Original database checksums matched before and after both the API and browser
  checks. The temporary API stopped, the scratch database was dropped, and
  temporary dump/session fixtures were removed.

The first browser attempt could not retain its temporary API between tool calls.
The same browser pass was subsequently completed with a persistent test server.
No normal-database test-write fallback was used.

Observed issues passed to the approved next phases: transient invalid-date
requests while filling a filter range, and mobile Settings content near the
fixed bottom navigation. These were not counted as verified improvements.

## Limits

Private browser sessions were controlled test fixtures exercising the existing
session middleware. Real Replit OIDC sign-in was not completed or claimed.
The permission suite is not a penetration test or proof of production setup.

The broader visual redesign and navigation improvements are separate approved
work. The workflow board and Manager-only CSV export remain queued, not removed
from scope. Authentication and database-schema changes require separate approval.
