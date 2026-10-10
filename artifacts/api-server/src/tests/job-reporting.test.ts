import assert from "node:assert/strict";
import { boardJobs, csvCell, filterJobs, jobsCsv } from "../lib/job-reporting";
import type { JobView } from "../lib/material-store";
const make = (id:string, changes: Partial<JobView> = {}): JobView => ({
  id, reference:id, createdAt:"2026-10-07T08:00:00Z", closedAt:null,
  status:"draft", material:"ورق", machine:"M1", product:"P",
  signals:[], investigationNotes:[], issued:100, good:80, reusable:10,rework:0,
  scrapEntries:[{reason:"unspecified_demo",weight:10}],
  metrics:{scrap:10,yieldPercent:80,scrapPercent:10},
  ...changes,
} as JobView);
const jobs = [make("draft"), make("closed",{status:"closed",closedAt:"2026-10-08T00:00:00Z",signals:["insufficient_history"]}),
  make("signal",{status:"closed",signals:["high_scrap"]}),
  make("note",{investigationNotes:[{id:"n",text:"Review",createdAt:"2026-10-07"}]})];
const before = JSON.stringify(jobs);
const board = boardJobs(jobs);
assert.deepEqual(board.jobs.map(j=>j.id),["draft"]);
assert.deepEqual(board.closed.map(j=>j.id),["closed"]);
assert.deepEqual(board.investigation.map(j=>j.id),["signal","note"]);
assert.deepEqual(boardJobs([]),{jobs:[],investigation:[],closed:[]});
assert.deepEqual(filterJobs(jobs,{from:"2026-10-08",to:"2026-10-08",machine:"M1",material:"ورق",status:"closed",search:"CLOSED"}).map(j=>j.id),["closed"]);
assert.deepEqual(filterJobs(jobs,{machine:"other"}),[]);
assert.equal(csvCell('a,"b"\nع'),'"a,""b""\nع"');
for(const input of ["=1+1","+cmd","-cmd","@SUM(A1)","  =1","\ttext","\rtext","\ntext"])
  assert.ok(csvCell(input).startsWith('"\''));
assert.equal(csvCell(10),'"10"');
const csv=jobsCsv(jobs);
assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes("ورق"));
assert.ok(csv.includes('"100","80","10"'));
assert.ok(csv.includes("unspecified_demo: 10"));
assert.ok(csv.endsWith("\r\n"));
assert.equal(jobsCsv([]).split("\r\n").length,2);
assert.equal(JSON.stringify(jobs),before);
console.log("Board mapping, filters, CSV escaping/encoding/formula protection and immutability passed");
