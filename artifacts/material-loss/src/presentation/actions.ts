/**
 * Local presentation transitions only. These checks demonstrate UX; they are
 * NOT authorization and never grant access to a real account or workspace.
 */
import { closureError, validWeight } from "@workspace/material-accounting";
import { stateSchema, WORKER, MANAGER, TOLERANCE, type PresentationJob, type PresentationState } from "./store";

export type DraftInput = Pick<PresentationJob,
  "reference" | "product" | "material" | "machine" | "issued" | "good" |
  "reusable" | "rework" | "scrapEntries" | "notes">;

function fail(code: string): never { throw new Error(code); }
function canSee(state: PresentationState, job: PresentationJob) {
  return state.view === "manager" || job.createdBy === WORKER || job.assignedTo === WORKER;
}
export function visibleJobs(state: PresentationState): PresentationJob[] {
  return state.jobs.filter(job => canSee(state,job)).map(job =>
    state.view === "worker" ? { ...job, investigationNotes: [] } : job);
}
function find(state: PresentationState, id: string) {
  return state.jobs.find(j => j.id === id && canSee(state,j)) ?? fail("NOT_FOUND");
}
function manager(state: PresentationState) {
  if (state.view !== "manager") fail("FORBIDDEN");
}
function checked(state: PresentationState): PresentationState {
  const result = stateSchema.safeParse(state);
  return result.success ? result.data : fail("INVALID_INPUT");
}
function replace(state: PresentationState, job: PresentationJob) {
  return checked({ ...state, jobs: state.jobs.map(j => j.id === job.id ? job : j) });
}
export function saveDraft(state: PresentationState, input: DraftInput, id?: string) {
  if (![input.issued,input.good,input.reusable,input.rework,...input.scrapEntries.map(e => e.weight)].every(validWeight)) fail("INVALID_WEIGHT");
  if (input.scrapEntries.some(e => e.weight > 0 && !e.reason.trim())) fail("INVALID_INPUT");
  const existing = id ? find(state,id) : null;
  if (existing?.status === "closed") fail("CLOSED_JOB");
  // Explicit writable fields: simulated identity/status cannot be injected.
  const data: DraftInput = {
    reference: input.reference.trim(), product: input.product, material: input.material, machine: input.machine,
    issued: input.issued, good: input.good, reusable: input.reusable, rework: input.rework,
    scrapEntries: input.scrapEntries.map(e => ({reason:e.reason.trim(),weight:e.weight})), notes: input.notes,
  };
  if (existing) return replace(state,{...existing,...data});
  const job: PresentationJob = {
    ...data, id:`pres-${crypto.randomUUID()}`, createdAt:new Date().toISOString(),
    status:"draft", closedAt:null, tolerance:TOLERANCE,
    createdBy:state.view === "worker" ? WORKER : MANAGER,
    assignedTo:state.view === "worker" ? WORKER : null, investigationNotes:[],
  };
  return checked({...state,jobs:[job,...state.jobs]});
}
export function closePresentationJob(state: PresentationState, id: string) {
  manager(state);
  const job = find(state,id);
  if (job.status !== "draft") fail("CLOSED_JOB");
  const error = closureError(job,TOLERANCE);
  if (error) fail(error);
  return replace(state,{...job,status:"closed",closedAt:new Date().toISOString(),tolerance:TOLERANCE});
}
export function reopenPresentationJob(state: PresentationState, id: string, reason: string) {
  manager(state);
  if (!reason.trim()) fail("NOTE_REQUIRED");
  if (reason.length > 5000) fail("INVALID_INPUT");
  const job = find(state,id);
  if (job.status !== "closed") fail("INVALID_INPUT");
  // A local-only history note preserves why the presenter reopened it.
  return replace(state,{...job,status:"draft",closedAt:null,investigationNotes:[
    ...job.investigationNotes,{id:`pres-reopen-${crypto.randomUUID()}`,text:reason.trim(),createdAt:new Date().toISOString()},
  ]});
}
export function addPresentationNote(state: PresentationState, id: string, text: string) {
  manager(state);
  if (!text.trim()) fail("NOTE_REQUIRED");
  if (text.length > 5000) fail("INVALID_INPUT");
  const job = find(state,id);
  return replace(state,{...job,investigationNotes:[
    ...job.investigationNotes,{id:`pres-note-${crypto.randomUUID()}`,text:text.trim(),createdAt:new Date().toISOString()},
  ]});
}
