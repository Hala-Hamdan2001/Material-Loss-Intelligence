# Material Loss Intelligence: presentation guide

## Open and explain

Open `/presentation` on the same app address, or use **Presentation mode** in the
normal workspace menu (opens a separate tab). No login is needed.

Tell the audience: **“These are synthetic records and simulated roles. This
demonstrates the workflow, not authentication or permission enforcement.”**

The existing Demo workspace and IK-202/IK-203 are separate. Your private workspace
may remain empty; presentation data is never uploaded into it.

## A short presentation sequence

1. Start as Manager. The initial dashboard has two closed jobs: 2,200 kg issued,
   1,720 kg good output, and 340 kg scrap. Drafts do not contribute to those totals.
2. Open PRES-002 and compare it with PRES-001. Scrap is 20% versus 10% — a ten
   percentage-point difference, not proof of a cause or avoidable loss.
3. Select **Present as Worker**, open assigned draft PRES-003, and edit its outcomes.
   Its starting balance is 100 kg issued, 80 kg good, 10 kg reusable, and 10 kg scrap.
   Save the draft.
4. Select **Present as Manager** and review PRES-003. Add an investigation note,
   making clear it is an unverified observation. A note does not close a job.
5. Close the balanced job. The dashboard now has three closed jobs: 2,300 kg issued,
   1,800 kg good output, and 350 kg scrap.
6. Switch to Worker to show that this simulated view has no close/reopen,
   comparison, analytics, or investigation-note controls.
7. Use **Reset presentation** to repeat the same scenario. Confirming reset affects
   only presentation records, not Demo or private workspaces.

To demonstrate validation, change good output from 80 to 75 in the draft. It can
be saved as a draft, but its 5 kg residual prevents closure. Restore 80 before
closing. Reusable offcuts and rework remain separate from scrap.

## Data lifetime and limitations

- Data lives in `sessionStorage` under `mli.presentation.v1`, never the database.
- Refresh retains saved edits. Browser session restoration or tab duplication may
  retain/copy that storage, so use Reset rather than promising deletion on close.
- If storage is unavailable, an explicit warning appears and changes are memory-only.
- Corrupt saved data is reported and not silently overwritten. Reset is required
  to recover a writable presentation.
- Never enter confidential production data. This storage is not an encrypted
  factory record system or a secure multi-user workspace.
- Role/view switching is local UI state, not an account, session, or membership.
- Dates and seed observations are synthetic. The two-job history is insufficient
  for the existing five-job baseline rule; that rule is not relaxed.
- There are no invitation, workflow-board, export, or AI-generation features in
  this addition. Investigation uses existing accounting signals/observations and
  notes, not a new investigation-status model.

## Real factory onboarding

The real app still requires each person to sign in with their own Replit account.
The Manager adds an already-registered user's application account ID as Manager
or Worker; the user selects the shared workspace and can receive job assignments.

Invitation emails/links, acceptance/expiry/cancellation, and guided factory
onboarding are not implemented. The earlier real OIDC end-to-end login test was
blocked; successful presentation switching provides no additional OIDC evidence.
See `phase1-access.md` for actual authorization testing and its limitations.

## Isolation and regression checks

Commands that do not touch the application database:

```sh
pnpm --filter @workspace/scripts exec tsx ../artifacts/material-loss/src/presentation/isolation.test.ts
pnpm --filter @workspace/scripts exec tsx ../artifacts/material-loss/src/presentation/actions.test.ts
pnpm --filter @workspace/material-accounting test
pnpm run typecheck
```

Six isolation checks cover the document-entry boundary, synthetic seeds, local-only
storage access, invalid/unavailable storage, and the transitive runtime imports.
Ten local workflow tests cover view restrictions, shared weight and closure
validation, notes independent of accounting, close/reopen, and aggregation.
All ten existing accounting tests also passed, including IK-202 and IK-203.

The final automated browser journey also passed:
- Zero attempted `/api/` requests across the normal and unavailable-storage
  presentation contexts; requests were monitored and would have been aborted.
- Worker edit/create/save, persistence after refresh, Manager investigation,
  invalid closure prevention, valid closure, and resulting dashboard totals.
- English/Arabic switching retained form input; dirty-form cancellation and
  reset cancellation preserved state.
- Accepted reset affected only presentation storage. Cookies were unchanged
  (zero before and after in the isolated signed-out context), and unrelated
  local/session storage sentinels remained intact.
- Corrupt storage showed an explicit error with mutations blocked until reset;
  unavailable storage showed the memory-only warning without a server fallback.
- Arabic RTL at 390px had no horizontal page overflow, including comparison and
  closure-dialog views.

No real login, production data, database fixtures, or real authorization was
exercised by that browser run. The Exit link was checked without following it
into the normal app.

The normal app's form wrapper retains its original API hook; presentation uses the
same form core with explicitly supplied local reference data. Shared formatting
was extracted without changing its calculations. No backend, database schema,
API contract, or authorization module was changed. The database-writing Phase 1
integration suite was deliberately not rerun in this phase.

Before implementation, a code recovery bundle was saved in the ignored
`.local/recovery/presentation/` directory. No database migration or restore is
needed for this frontend-only addition.
