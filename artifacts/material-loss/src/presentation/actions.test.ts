import assert from "node:assert/strict";
import { aggregate, calculate } from "@workspace/material-accounting";
import { seedPresentation, WORKER, type PresentationState } from "./store";
import { visibleJobs, saveDraft, closePresentationJob, reopenPresentationJob, addPresentationNote } from "./actions";

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`PASS ${name}`); }
const worker = (): PresentationState => ({...seedPresentation(),view:"worker"});
const input = {reference:"PRES-REVIEW",product:"Presentation boards",material:"Greyboard 2 mm",machine:"PRES-CT-2",
  issued:100,good:80,reusable:10,rework:0,scrapEntries:[{reason:"setup_layout",weight:10}],notes:"Synthetic only"};
test("Worker local view shows only own/assigned jobs and hides investigation notes", () => {
  assert.deepEqual(visibleJobs(worker()).map(j => j.id),["pres-003"]);
  const noted = addPresentationNote(seedPresentation(),"pres-003","Synthetic observation");
  assert.deepEqual(visibleJobs({...noted,view:"worker"})[0]!.investigationNotes,[]);
});
test("Worker creates a local draft without mutating the input state", () => {
  const prior = worker(); const saved = saveDraft(prior,input);
  assert.equal(prior.jobs.length,4); assert.equal(saved.jobs.length,5);
  assert.equal(saved.jobs[0]!.createdBy,WORKER); assert.equal(saved.jobs[0]!.status,"draft");
  assert.ok(saved.jobs[0]!.id.startsWith("pres-"));
});
test("Worker assigned draft save preserves identity and cannot edit an unassigned job", () => {
  const saved = saveDraft(worker(),input,"pres-003");
  assert.equal(saved.jobs.find(j=>j.id==="pres-003")!.reference,input.reference);
  assert.equal(saved.jobs.find(j=>j.id==="pres-003")!.createdBy,"presentation-manager");
  assert.throws(()=>saveDraft(worker(),input,"pres-004"),/NOT_FOUND/);
});
test("Worker cannot simulate Manager mutations", () => {
  assert.throws(()=>closePresentationJob(worker(),"pres-003"),/FORBIDDEN/);
  assert.throws(()=>reopenPresentationJob(worker(),"pres-001","Reason"),/FORBIDDEN/);
  assert.throws(()=>addPresentationNote(worker(),"pres-003","Note"),/FORBIDDEN/);
});
test("Shared weight checks reject negatives and excess precision", () => {
  for (const issued of [-1,1.0001,NaN,Infinity,100000001]) assert.throws(()=>saveDraft(worker(),{...input,issued}),/INVALID_WEIGHT/);
});
test("Valid draft saves even if unbalanced, but shared closure validation rejects it", () => {
  const state = saveDraft(seedPresentation(),{...input,good:70},"pres-003");
  assert.throws(()=>closePresentationJob(state,"pres-003"),/UNBALANCED/);
});
test("Shared closure validation rejects zero issued and missing required fields", () => {
  let state = saveDraft(seedPresentation(),{...input,issued:0},"pres-003");
  assert.throws(()=>closePresentationJob(state,"pres-003"),/ZERO_ISSUED/);
  state = saveDraft(seedPresentation(),{...input,product:""},"pres-003");
  assert.throws(()=>closePresentationJob(state,"pres-003"),/REQUIRED_FIELDS/);
});
test("Investigation notes never change accounting status, weights or dashboard totals", () => {
  const state = seedPresentation(); const totals = aggregate(state.jobs);
  const updated = addPresentationNote(state,"pres-003","Inspect sheets; cause unverified.");
  assert.equal(updated.jobs[2]!.status,"draft");
  assert.deepEqual(calculate(updated.jobs[2]!),calculate(state.jobs[2]!));
  assert.deepEqual(aggregate(updated.jobs),totals);
});
test("Manager review closes Worker draft and shared closed-only dashboard updates", () => {
  const saved = saveDraft(worker(),input,"pres-003");
  const closed = closePresentationJob({...saved,view:"manager"},"pres-003");
  const totals = aggregate(closed.jobs);
  assert.equal(totals.totalJobs,3); assert.equal(totals.issued,2300);
  assert.equal(totals.scrap,350); assert.equal(totals.good,1800);
  assert.throws(()=>saveDraft({...closed,view:"worker"},input,"pres-003"),/CLOSED_JOB/);
});
test("Reopening requires a reason and removes job from closed-only dashboard", () => {
  const closed = closePresentationJob(seedPresentation(),"pres-003");
  assert.throws(()=>reopenPresentationJob(closed,"pres-003"," "),/NOTE_REQUIRED/);
  const open = reopenPresentationJob(closed,"pres-003","Synthetic recheck");
  assert.equal(aggregate(open.jobs).totalJobs,2);
  assert.equal(open.jobs[2]!.status,"draft");
});
console.log(`${passed} local workflow tests passed. These are presentation checks, not authentication tests.`);
