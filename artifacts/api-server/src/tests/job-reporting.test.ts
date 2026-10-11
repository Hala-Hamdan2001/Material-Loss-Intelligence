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
const englishHeaders = ["Job number", "Created date", "Product", "Material", "Machine",
  "Issued (kg)", "Good output (kg)", "Scrap (kg)", "Scrap reasons (kg)",
  "Reusable offcuts (kg)", "Rework (kg)", "Yield (%)", "Scrap (%)", "Accounting status", "Closed date"];
const arabicHeaders = ["رقم الأمر", "تاريخ الإنشاء", "المنتج", "المادة", "الآلة",
  "الوزن المصروف (كغ)", "الإنتاج السليم (كغ)", "الخردة (كغ)", "أسباب الخردة (كغ)",
  "القصاصات القابلة لإعادة الاستخدام (كغ)", "إعادة التشغيل (كغ)", "المردود (%)", "نسبة الخردة (%)",
  "الحالة المحاسبية", "تاريخ الإغلاق"];
assert.equal(jobsCsv(jobs, "en"), csv);
const tricky = [...jobs, make("=1+1", { product: 'منتج,"خاص"\nسطر', machine: "@SUM(A1)", material: "  +cmd" })];
for (const [language, headers] of [["en", englishHeaders], ["ar", arabicHeaders]] as const) {
  const localized = jobsCsv(tricky, language);
  assert.equal(localized.split("\r\n")[0], "\uFEFF" + headers.map(csvCell).join(","));
  assert.equal(Buffer.from(localized).subarray(0,3).toString("hex"), "efbbbf");
  assert.ok(localized.includes('"\'=1+1"'));
  assert.ok(localized.includes('"\'@SUM(A1)"'));
  assert.ok(localized.includes('"\'  +cmd"'));
  assert.ok(localized.includes('"منتج,""خاص""\nسطر"'));
  assert.equal(jobsCsv([], language), "\uFEFF" + headers.map(csvCell).join(",") + "\r\n");
}
const dataRows = (text: string) => text.slice(text.indexOf("\r\n") + 2);
assert.equal(dataRows(jobsCsv(tricky, "ar")), dataRows(jobsCsv(tricky, "en")));
assert.equal(JSON.stringify(jobs),before);
console.log("Board mapping, filters, CSV escaping/encoding/formula protection and immutability passed");
