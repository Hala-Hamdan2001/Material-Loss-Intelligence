# Board and CSV delivery

## Behavior

The sidebar Board opens `/board`. Server endpoint `/api/jobs/board` uses the
existing authorized workspace and Manager guard (Demo retains its management
experience; Workers receive 403). Cards link to real detail pages and existing
authorized note/close/reopen actions; no drag/drop or separate client status exists.

Investigation has priority when there are existing investigation notes or
`high_scrap`/`above_baseline` signals. Otherwise closed jobs appear in Closed;
remaining drafts appear in Jobs. `insufficient_history` alone never flags a job.
The actual accounting status is separately displayed. No accounting, threshold,
closure or dashboard calculation changed.

There is no investigation-resolution field in the existing schema. Historical
investigation notes therefore keep a job in Need Investigation; this release does
not introduce manual “resolve”/drag/drop behavior or a migration.

Jobs now offers Export CSV to Managers/Demo, using `/api/jobs/export.csv`.
The endpoint checks workspace membership and Manager access before loading data.
Search, machine, material, accounting status and effective date range use the same
filter function as the Jobs API. No filters means all authorized workspace jobs.
Dates retain existing closed-date-or-created-date semantics. Empty results export
headers only. An invalid/reversed date range is rejected by the export endpoint.

Fields: job number, creation timestamp, product, material, machine, issued/good/scrap
weights, recorded scrap reasons and weights, reusable offcuts, rework, yield and
scrap percentages, accounting status and closure timestamp. Existing accounting
results are reused. No session, account, membership or investigation-note data is
included. Reason codes are preserved rather than invented or relabeled.

UTF-8 BOM preserves Arabic in Excel; cells are quoted with escaped quotes,
CRLF rows and formula-prefix protection for untrusted text. Export aborts when the
Jobs page unmounts (including workspace/role scope changes).

## Actual verification

- 23 isolated API permission/regression groups passed, including Worker board/CSV
  403, foreign-workspace denial, filtered CSV BOM/content, mixed Manager
  removal/demotion, session tests and existing unbalanced closure rejection.
- Focused board/CSV assertions passed: investigation priority, insufficient-history
  exclusion, empty states, combined filters, CSV quotes/newlines/Arabic/BOM,
  formula protection, values and non-mutation.
- Ten accounting tests, eight dashboard-series checks, navigation assertions,
  full workspace typechecking, API build and frontend production build passed.
- Browser checks used only a scratch API/database: Demo board IK-202 investigation
  with Closed badge; IK-203 Closed; IK-204 Jobs. Card/detail/Board return worked.
- Actual browser download filtered to IK-203 contained only that record and
  correct 1000/820/100 issued/good/scrap values with UTF-8 BOM.
- Private Manager board and export contained only its fixture job. Worker direct
  board route was restricted, export button absent, and both APIs returned 403.
- Arabic RTL Jobs and Board at 390px showed no horizontal overflow; export
  remained reachable. Desktop board inspected.
- Read-only original-database query confirmed all eight existing Demo copies each
  retain original IK-202 and IK-203 weights/reasons/status. Original eight-table
  checksums matched after both isolated API and browser runs. Scratch databases,
  servers, dumps and session fixtures were removed.
- Existing non-blocking source-map and bundle-size build warnings remain.

No authentication/schema/business-record modifications or production operations.
The user reports manually verifying real Manager login/logout/login-again.
This run used synthetic isolated sessions for role checks; real Worker login
remains unverified. Excel compatibility was checked at CSV byte/content level,
not by launching desktop Excel.
