import assert from "node:assert/strict";
import { aggregate, type HistoricalJob } from "@workspace/material-accounting";
import { performanceJobs } from "../lib/dashboard-performance";

const job = (n: number, overrides: Partial<HistoricalJob> = {}): HistoricalJob => ({
  id: `job-${n}`, status: "closed", machine: "A", material: "Board", product: "Panel",
  issued: 100, good: 80, reusable: 10, rework: 0,
  scrapEntries: [{ reason: "unspecified_demo", weight: 10 }],
  createdAt: `2026-10-${String(n).padStart(2, "0")}T10:00:00Z`,
  closedAt: `2026-10-${String(n).padStart(2, "0")}T11:00:00Z`,
  tolerance: 0.1, ...overrides,
});
let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }

check("empty workspace produces no invented jobs", () => assert.deepEqual(performanceJobs([]), []));
check("single closed job remains available", () => assert.deepEqual(performanceJobs([job(1)]), [job(1)]));
check("latest six ordered by closure, not input or creation", () => {
  assert.deepEqual(performanceJobs(Array.from({ length: 9 }, (_, i) => job(i + 1))).map(j => j.id),
    ["job-9", "job-8", "job-7", "job-6", "job-5", "job-4"]);
});
check("drafts and invalid closures never displace valid closed jobs", () => {
  const drafts = Array.from({ length: 7 }, (_, i) => job(i + 10, { status: "draft", closedAt: null }));
  assert.deepEqual(performanceJobs([...drafts, job(8, { good: 70 }), job(2), job(1)]).map(j => j.id), ["job-2", "job-1"]);
});
check("already filtered scope is not widened", () => {
  assert.deepEqual(performanceJobs([job(4), job(3)]).map(j => j.id), ["job-4", "job-3"]);
});
check("zero scrap retained and unknown reasons not invented", () => {
  const zero = job(1, { good: 90, scrapEntries: [] });
  assert.equal(performanceJobs([zero]).length, 1);
  assert.deepEqual(performanceJobs([job(2)])[0].scrapEntries, [{ reason: "unspecified_demo", weight: 10 }]);
});
check("input records, order, and aggregate accounting stay unchanged", () => {
  const jobs = [job(1), job(2), job(3, { status: "draft", closedAt: null })];
  const before = JSON.stringify(jobs);
  const totals = aggregate(jobs);
  performanceJobs(jobs);
  assert.equal(JSON.stringify(jobs), before);
  assert.deepEqual(aggregate(jobs), totals);
});
check("equal timestamps have stable identifier order", () => {
  assert.deepEqual(performanceJobs([job(2, { closedAt: job(1).closedAt }), job(1)]).map(j => j.id), ["job-1", "job-2"]);
});
console.log(`${passed} dashboard performance checks passed`);
