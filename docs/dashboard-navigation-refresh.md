# Actual application refresh: Phases B–C

## Delivered scope

- Navy/teal desktop sidebar, tablet rail and Arabic-aware mobile drawer;
  active states, shared rounded cards/buttons/inputs, typography and spacing.
- Styling applies to Dashboard, Jobs, detail, create/edit and Settings.
- Scrap-reason donut uses actual positive reason weights and server percentages;
  unspecified legacy Demo reasons are retained and explicitly labeled.
- Dashboard API adds `performanceJobs`: newest six valid closed jobs from the
  existing workspace/date-filtered set. Authorization, existing fields,
  accounting functions, baseline rules, and schemas are unchanged.
- Job scrap-rate chart includes a readable data table and context. It is a
  descriptive comparison, not a matched cohort or proven avoidable loss.
- URL-backed Dashboard/Jobs filters, validated internal return paths, and
  workspace-scoped in-memory scroll positions preserve navigation context.
- Successful workspace switching clears the prior URL filters/return path.
- Invalid dates/ranges show the last-valid-period warning without sending the
  invalid pair to the API. While a native date input is partially typed, the
  browser can expose an empty value and temporarily select an open-ended range.
- In-app navigation, cancel, back links, sign-out and tab unload have draft
  warnings. Browser Back/Forward preserve URL filters but do not yet present an
  in-app unsaved-draft confirmation.

Workflow board and Manager-only CSV export remain queued. No invitations,
authentication configuration changes, database migration, new accounting rules,
or additional production seed data were part of this implementation.

## Verification performed

Phase A's completed gate is recorded in `presentation-removal.md`.

After the additions:
- Eight pure dashboard-series checks passed: empty/single job, latest-six
  ordering, draft/invalid-closure exclusion, supplied-scope preservation,
  zero/unknown scrap, immutable input/accounting, deterministic equal timestamps.
- Navigation helper assertions passed, including valid/invalid return targets,
  date validation, query construction, and workspace-scoped scroll memory.
- Full workspace typechecking and the production frontend build passed.
  The build reports non-blocking source-map and bundle-size warnings.
- Focused browser tests used a scratch database and temporary API only.
  Charts matched IK-202/IK-203 (20%/10% scrap); filtered charts matched the
  requested date; unknown reasons were not invented.
- Private Worker dashboard requests remained 403 with no performance payload.
- Browser tests confirmed filter reload/Forward behavior, detail/edit return
  context, cancel-without-discard, workspace filter reset, draft-only dashboards,
  and restoration of the exact list scroll position.
- English desktop and Arabic RTL desktop/tablet/phone screens were inspected.
  The mobile drawer and New/Settings controls were reachable without overlay.
- Original database checksums matched after testing; scratch data, temporary
  credentials and API processes were removed.

The browser pass found chart overflow, retained cross-workspace filters, and
misleading draft-only empty-state wording. These were fixed and browser-rechecked.
Subsequent small fixes expanded KPI card widths/removed value ellipsis, gave
mobile member IDs their own line, and explicitly restored drawer-trigger focus.
Those last three were typechecked and built, not separately browser-retested.

## Remaining verification boundaries

Real Replit OIDC sign-in and production authorization were not reverified.
Private UI checks used isolated session fixtures with the unchanged real session
middleware. This is not a penetration test or approval to publish an unmigrated
production database.
