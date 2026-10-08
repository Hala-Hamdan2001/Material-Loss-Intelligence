import assert from "node:assert/strict";
const base = "http://localhost:80/api";
const cookies = new Map();
async function request(path, method = "GET", body, expected = 200, jar = cookies) {
  const response = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json", Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join("; ") },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [key, ...value] = cookie.split(";")[0].split("="); jar.set(key,value.join("="));
  }
  const data = await response.json();
  assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
const workspace = await request("/workspace");
assert.equal(workspace.isDemo,true);
const jobs = await request("/jobs");
const a=jobs.find(j=>j.reference==="IK-202"), b=jobs.find(j=>j.reference==="IK-203");
assert.equal(a.metrics.yieldPercent,75); assert.equal(a.metrics.scrap,240);
assert.equal(a.metrics.largestContribution,75); assert.equal(b.metrics.scrapPercent,10);
const dashboard = await request("/dashboard");
assert.equal(dashboard.totalJobs,2); assert.equal(dashboard.draftCount,1);
assert.equal(dashboard.scrapPercent,340/2200*100);
const comparison = await request(`/jobs/${a.id}/comparison?comparisonId=${b.id}`);
assert.equal(comparison.difference,10); assert.equal(comparison.baseline.sufficient,false);
assert.equal((await request("/jobs?status=draft")).length,1);
const input = {reference:"API-CHECK",product:"Test",material:"Board",machine:"CT-2",issued:100,good:70,reusable:10,rework:0,scrapEntries:[{reason:"setup_layout",weight:10}],notes:""};
let job = await request("/jobs","POST",input,201);
assert.equal((await request(`/jobs/${job.id}/close`,"POST",{revision:job.revision},400)).error,"UNBALANCED");
await request("/jobs","POST",{...input,reference:"NEGATIVE",good:-1},400);
let zero = await request("/jobs","POST",{...input,reference:"ZERO",issued:0},201);
assert.equal((await request(`/jobs/${zero.id}/close`,"POST",{revision:zero.revision},400)).error,"ZERO_ISSUED");
job = await request(`/jobs/${job.id}`,"PATCH",{...input,good:80,revision:job.revision});
await request(`/jobs/${job.id}`,"PATCH",{...input,revision:1},409);
job = await request(`/jobs/${job.id}/close`,"POST",{revision:job.revision});
assert.equal(job.status,"closed"); assert.equal(job.metrics.residual,0);
await request(`/jobs/${job.id}`,"PATCH",{...input,revision:job.revision},409);
job = await request(`/jobs/${job.id}/notes`,"POST",{text:"Recorded observation, not a verified cause."});
assert.equal(job.investigationNotes.length,1);
job = await request(`/jobs/${job.id}/reopen`,"POST",{revision:job.revision,reason:"Correcting entered quantities"});
assert.equal(job.status,"draft");
assert.equal((await request("/dashboard")).totalJobs,2);
await request("/workspace","POST",{mode:"private"},401);
await request(`/jobs/${a.id}`,"GET",undefined,404,new Map());
const login = await fetch(base+"/login",{redirect:"manual"});
assert.equal(login.status,302);
assert.equal(new URL(login.headers.get("location")).hostname,"replit.com");
const insight = await request(`/jobs/${a.id}/insights`,"POST",{language:"ar",comparisonId:b.id});
assert.equal(insight.language,"ar"); assert.match(insight.text,/الهدر/);
assert.ok(["ai","fallback"].includes(insight.source));
console.log("API checks passed: exact demo metrics, weighted dashboard, filters, closure, invalid weights, zero issued, stale revisions, notes/reopen, demo isolation, private access denial, login redirect, Arabic insight.");
console.log(`Insight source: ${insight.source}`);
