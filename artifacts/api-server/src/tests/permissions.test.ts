/**
 * Development-only API integration checks. Creates isolated fixtures, never uses
 * existing accounts or records, and removes its own fixtures in finally.
 * Session fixtures exercise the real session middleware, not a test HTTP bypass.
 */
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "@workspace/db";

if (process.env.NODE_ENV === "production") throw new Error("Development-only test; refused in production.");
const base = process.env.TEST_API_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+\/api$/.test(base)) throw new Error("Explicit loopback scratch API required.");
const database = await pool.query("SELECT current_database() AS name");
if (!/^mli_phase_a_\d+_\d+$/.test(database.rows[0].name)) {
  await pool.end();
  throw new Error("Refusing writes outside a uniquely named scratch database.");
}
const ids = Array.from({length:4},()=>`phase1-test-${randomUUID()}`);
const organizations = new Set<string>();
const sessions: string[] = [];
let checks = 0;
const verify = (label: string, fn: () => void) => { fn(); checks++; console.log(`PASS ${label}`); };
class Client {
  cookies = new Map<string,string>();
  constructor(public token?: string) {}
  async call(path: string, method="GET", body?: unknown, expected: number | number[]=200, extra: Record<string,string>={}): Promise<any> {
    const response = await fetch(base+path,{method,headers:{
      "Content-Type":"application/json", Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),
      ...(this.token ? {Authorization:`Bearer ${this.token}`} : {}), ...extra,
    },body:body === undefined ? undefined : JSON.stringify(body),redirect:"manual"});
    for (const raw of response.headers.getSetCookie()) {
      const [key,...value] = raw.split(";")[0]!.split("=");
      this.cookies.set(key!,value.join("="));
    }
    const data = response.headers.get("content-type")?.includes("application/json")
      ? await response.json() : { redirect: response.headers.get("location") };
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status),`${method} ${path} (${response.status}): ${JSON.stringify(data)}`);
    return data;
  }
}
async function session(id: string, expired=false) {
  const token = randomBytes(32).toString("hex"); sessions.push(token);
  await pool.query("INSERT INTO sessions (sid,sess,expire) VALUES ($1,$2,$3)",[
    token,JSON.stringify({user:{id,email:null,firstName:"Test",lastName:"User",profileImageUrl:null},
      access_token:"test-not-a-provider-token",expires_at:Math.floor(Date.now()/1000)+(expired?-60:3600)}),
    new Date(Date.now()+3600000),
  ]);
  return new Client(token);
}
const input = {reference:"PERMISSIONS",product:"Test product",material:"Test material",machine:"Test machine",
  issued:100,good:80,reusable:10,rework:0,scrapEntries:[{reason:"setup_layout",weight:10}],notes:"Operator observation"};
try {
  for (const id of ids) await pool.query("INSERT INTO users (id,first_name,last_name) VALUES ($1,'Test','User')",[id]);
  const manager = await session(ids[0]!);
  const worker = await session(ids[1]!);
  const outsider = await session(ids[2]!);
  const otherWorker = await session(ids[3]!);
  const anon = new Client();
  await anon.call("/workspaces","GET",undefined,401);
  await anon.call("/workspace","POST",{mode:"private"},401);
  const exp = await session(ids[0]!,true);
  await exp.call("/workspaces","GET",undefined,401);
  verify("anonymous and expired sessions denied private access",()=>{});
  await new Client(randomBytes(32).toString("hex")).call("/workspaces","GET",undefined,401);
  const dbExpired = await session(ids[0]!);
  await pool.query("UPDATE sessions SET expire=now()-interval '1 second' WHERE sid=$1",[dbExpired.token]);
  await dbExpired.call("/workspaces","GET",undefined,401);
  const revoked = await session(ids[0]!);
  await pool.query("DELETE FROM sessions WHERE sid=$1",[revoked.token]);
  await revoked.call("/workspaces","GET",undefined,401);
  verify("invalid, database-expired and deleted sessions denied",()=>{});
  const logoutClient = await session(ids[0]!);
  const loggedOut = await logoutClient.call("/logout?returnTo=%2F%5Cattacker.example","GET",undefined,302);
  assert.equal(loggedOut.redirect,"/");
  await logoutClient.call("/workspaces","GET",undefined,401);
  const remainingSession = await pool.query("SELECT sid FROM sessions WHERE sid=$1",[logoutClient.token]);
  assert.equal(remainingSession.rowCount,0);
  verify("web logout deletes session despite unavailable provider and rejects external return path",()=>{});
  const mobileLogout = await session(ids[0]!);
  await mobileLogout.call("/mobile-auth/logout","POST",{});
  await mobileLogout.call("/workspaces","GET",undefined,401);
  const callback = new Client();
  callback.cookies.set("state","not-a-real-state");
  callback.cookies.set("code_verifier","not-a-real-verifier");
  assert.equal((await callback.call("/callback?code=invalid","GET",undefined,302)).redirect,"/api/login");
  verify("mobile logout invalidates session; callback without nonce rejected before provider use",()=>{});
  const org = await manager.call("/workspace","POST",{mode:"private"}); organizations.add(org.id);
  const other = await outsider.call("/workspace","POST",{mode:"private"}); organizations.add(other.id);
  verify("new private owner is Manager only in own workspace",()=>assert.equal(org.role,"manager"));
  anon.cookies.set("mli_mode","private"); anon.cookies.set("mli_workspace",org.id);
  for (const path of ["/workspace","/jobs","/dashboard","/workspace/members","/reference-data"])
    await anon.call(path,"GET",undefined,401);
  verify("forged private-selection cookies do not authenticate anonymous API requests",()=>{});
  await worker.call("/workspace","POST",{mode:"private",workspaceId:org.id},403);
  await manager.call("/workspace/members","POST",{userId:ids[1],role:"worker",active:true});
  await manager.call("/workspace/members","POST",{userId:ids[3],role:"worker",active:true});
  await worker.call("/workspace","POST",{mode:"private",workspaceId:org.id});
  await otherWorker.call("/workspace","POST",{mode:"private",workspaceId:org.id});
  await manager.call("/workspace/members","POST",{userId:ids[0],role:"worker",active:true},409);
  await manager.call("/workspace/members","POST",{userId:ids[0],role:"manager",active:false},409);
  await worker.call("/workspace/members","POST",{userId:ids[1],role:"manager",active:true},403);
  verify("manager membership provisioning, no self-promotion, last Manager protected",()=>{});
  const legacy = await manager.call("/jobs","POST",input,201);
  const workerJob = await worker.call("/jobs","POST",{...input,reference:"WORKER",createdBy:ids[0],assignedTo:ids[2],organizationId:other.id,role:"manager"},201);
  verify("client ownership/role injection ignored; server owns creator",()=>{
    assert.equal(workerJob.createdBy,ids[1]);assert.equal(workerJob.assignedTo,null);
  });
  await worker.call(`/jobs/${legacy.id}`,"GET",undefined,404);
  await outsider.call(`/jobs/${legacy.id}`,"GET",undefined,404);
  await otherWorker.call(`/jobs/${workerJob.id}`,"GET",undefined,404);
  verify("same-workspace unassigned and cross-workspace records hidden",()=>{});
  for (const [path,method,data] of [
    [`/jobs/${legacy.id}`,"PATCH",{...input,revision:legacy.revision}],
    [`/jobs/${legacy.id}/close`,"POST",{revision:legacy.revision}],
    [`/jobs/${legacy.id}/reopen`,"POST",{revision:legacy.revision,reason:"foreign"}],
    [`/jobs/${legacy.id}/notes`,"POST",{text:"foreign"}],
    [`/jobs/${legacy.id}/assignment`,"POST",{assignedTo:null,revision:legacy.revision}],
    [`/jobs/${legacy.id}/comparison`,"GET",undefined],
    [`/jobs/${legacy.id}/insights`,"POST",{language:"en",comparisonId:""}],
  ] as const) await outsider.call(path,method,data,404);
  outsider.cookies.set("mli_workspace",org.id);
  for (const path of ["/jobs","/dashboard","/workspace/members","/reference-data"])
    await outsider.call(path,"GET",undefined,403);
  await outsider.call("/workspace/settings","PATCH",{tolerance:1,highScrapThreshold:20},403);
  await outsider.call("/workspace/members","POST",{userId:ids[2],role:"manager",active:true},403);
  outsider.cookies.set("mli_workspace",other.id);
  verify("cross-workspace lifecycle, investigations, assignment and forged workspace cookies denied",()=>{});
  for (const path of ["/dashboard",`/jobs/${workerJob.id}/comparison`,"/workspace/members"]) await worker.call(path,"GET",undefined,403);
  for (const [path,data] of [
    ["/workspace/settings",{tolerance:1,highScrapThreshold:20}],
    [`/jobs/${workerJob.id}/close`,{revision:workerJob.revision}],
    [`/jobs/${workerJob.id}/reopen`,{revision:workerJob.revision,reason:"test"}],
    [`/jobs/${workerJob.id}/notes`,{text:"restricted note"}],
    [`/jobs/${workerJob.id}/insights`,{language:"en",comparisonId:""}],
    [`/jobs/${workerJob.id}/assignment`,{revision:workerJob.revision,assignedTo:ids[1]}],
  ] as const) await worker.call(path,path==="/workspace/settings"?"PATCH":"POST",data,403);
  verify("Worker denied management API operations directly",()=>{});
  await manager.call(`/jobs/${legacy.id}/notes`,"POST",{text:"Manager-only investigation note"});
  let assigned = await manager.call(`/jobs/${legacy.id}`);
  assigned = await manager.call(`/jobs/${legacy.id}/assignment`,"POST",{assignedTo:ids[1],revision:assigned.revision});
  const visible = await worker.call(`/jobs/${legacy.id}`);
  verify("assigned worker sees job but no investigation notes or management signals",()=>{
    assert.deepEqual(visible.investigationNotes,[]); assert.deepEqual(visible.signals,[]);
  });
  const edited = await worker.call(`/jobs/${legacy.id}`,"PATCH",{...input,notes:"Updated by assigned worker",revision:visible.revision,
    createdBy:ids[1],assignedTo:ids[2],organizationId:other.id,status:"closed",role:"manager"});
  assert.equal(edited.createdBy,ids[0]); assert.equal(edited.assignedTo,ids[1]); assert.equal(edited.status,"draft");
  await worker.call(`/jobs/${legacy.id}`,"PATCH",{...input,revision:visible.revision},409);
  await manager.call(`/jobs/${legacy.id}/assignment`,"POST",{assignedTo:ids[2],revision:edited.revision},400);
  await manager.call(`/jobs/${legacy.id}/assignment`,"POST",{assignedTo:null,revision:edited.revision});
  await worker.call(`/jobs/${legacy.id}`,"GET",undefined,404);
  await worker.call(`/jobs/${legacy.id}`,"PATCH",{...input,revision:edited.revision},404);
  verify("assignment permits editing; stale writes, foreign assignees and removed assignment denied",()=>{});
  const refs = await otherWorker.call("/reference-data");
  verify("reference suggestions scoped to permitted records",()=>assert.deepEqual(refs.products,[]));
  const closed = await manager.call(`/jobs/${workerJob.id}/close`,"POST",{revision:workerJob.revision});
  await worker.call(`/jobs/${workerJob.id}`,"PATCH",{...input,revision:closed.revision},409);
  const dash = await manager.call("/dashboard");
  verify("manager closure and weighted closed-only dashboard unchanged",()=>{
    assert.equal(dash.totalJobs,1);assert.equal(dash.issued,100);assert.equal(dash.scrapPercent,10);
  });
  await manager.call(`/jobs/${workerJob.id}/reopen`,"POST",{revision:closed.revision,reason:"Test reopen"});
  await manager.call("/workspace/members","POST",{userId:ids[1],role:"manager",active:true});
  await worker.call("/dashboard");
  await manager.call("/workspace/members","POST",{userId:ids[1],role:"worker",active:true});
  await worker.call("/dashboard","GET",undefined,403);
  await manager.call("/workspace/members","POST",{userId:ids[1],role:"worker",active:false});
  await worker.call("/jobs","GET",undefined,403);
  await worker.call("/jobs","POST",{...input,reference:"REVOKED"},403);
  verify("role changes and revocation affect existing sessions immediately",()=>{});
  const choices = await worker.call("/workspaces");
  verify("revoked workspace removed from membership selector",()=>assert.ok(!choices.some((w:{id:string})=>w.id===org.id)));
  // Cookie session path, not only Bearer.
  const browser = new Client();
  browser.cookies.set("sid",manager.token!);browser.cookies.set("mli_mode","private");browser.cookies.set("mli_workspace",org.id);
  await browser.call("/dashboard");
  await browser.call("/workspace/settings","PATCH",{tolerance:.1,highScrapThreshold:15},403,{Origin:"https://attacker.example"});
  await browser.call("/workspace/settings","PATCH",{tolerance:.1,highScrapThreshold:15},403,{Origin:"not-an-origin"});
  verify("cookie authentication works; hostile and malformed origins rejected",()=>{});
  const demo = new Client();
  const dw = await demo.call("/workspace"); organizations.add(dw.id);
  const dj = await demo.call("/jobs"); const ik202 = dj.find((j:{reference:string})=>j.reference==="IK-202");
  const ik203 = dj.find((j:{reference:string})=>j.reference==="IK-203");
  const cmp = await demo.call(`/jobs/${ik202.id}/comparison?comparisonId=${ik203.id}`);
  verify("unauthenticated demo exact calculations/comparison preserved",()=>{
    assert.equal(dw.role,"demo");assert.equal(dw.userId,null);assert.equal(ik202.metrics.scrap,240);
    assert.equal(ik202.metrics.yieldPercent,75);assert.equal(ik202.metrics.largestContribution,75);assert.equal(cmp.difference,10);
  });
  const range = await demo.call("/dashboard?from=2026-10-07&to=2026-10-07");
  verify("inclusive date filter remains unchanged",()=>assert.equal(range.issued,1200));
  await demo.call(`/jobs/${legacy.id}`,"GET",undefined,404);
  await demo.call("/workspace","POST",{mode:"private",workspaceId:org.id},401);
  await demo.call("/workspace/members","POST",{userId:ids[1],role:"manager",active:true},403);
  await manager.call("/workspace","POST",{mode:"private",workspaceId:dw.id},403);
  // Forged private cookie never becomes a private identity in demo mode.
  demo.cookies.set("mli_workspace",org.id);
  assert.equal((await demo.call("/workspace")).id,dw.id);
  let demoNew = await demo.call("/jobs","POST",{...input,reference:"DEMO-FLOW"},201);
  demoNew = await demo.call(`/jobs/${demoNew.id}/close`,"POST",{revision:demoNew.revision});
  demoNew = await demo.call(`/jobs/${demoNew.id}/notes`,"POST",{text:"Demo investigation"});
  await demo.call(`/jobs/${demoNew.id}/reopen`,"POST",{revision:demoNew.revision,reason:"Demo reopen"});
  await demo.call("/workspace/settings","PATCH",{tolerance:.1,highScrapThreshold:15});
  const bad = await demo.call("/jobs","POST",{...input,reference:"UNBALANCED",good:70},201);
  await demo.call(`/jobs/${bad.id}/close`,"POST",{revision:bad.revision},400);
  await demo.call("/jobs","POST",{...input,reference:"NEGATIVE",good:-1},400);
  const zero = await demo.call("/jobs","POST",{...input,reference:"ZERO",issued:0},201);
  await demo.call(`/jobs/${zero.id}/close`,"POST",{revision:zero.revision},400);
  verify("demo CRUD/closure/notes/settings preserved; private boundary and validation enforced",()=>{});
  await manager.call("/workspace/members","POST",{userId:ids[2],role:"manager",active:true});
  await outsider.call("/workspace","POST",{mode:"private",workspaceId:org.id});
  await Promise.all([
    manager.call("/workspace/members","POST",{userId:ids[2],role:"manager",active:false},[200,403,409]),
    outsider.call("/workspace/members","POST",{userId:ids[0],role:"worker",active:true},[200,403,409]),
  ]);
  const retained = await pool.query("SELECT count(*)::int AS n FROM mli_memberships WHERE organization_id=$1 AND role='manager' AND active",[org.id]);
  verify("concurrent Manager removal/demotion cannot remove the last Manager",()=>assert.equal(retained.rows[0].n,1));
  console.log(`${checks} permission/regression groups passed.`);
} finally {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of organizations) {
      await client.query("DELETE FROM mli_insights WHERE job_id IN (SELECT id FROM mli_jobs WHERE organization_id=$1)",[id]);
      await client.query("DELETE FROM mli_events WHERE job_id IN (SELECT id FROM mli_jobs WHERE organization_id=$1)",[id]);
      await client.query("DELETE FROM mli_jobs WHERE organization_id=$1",[id]);
      await client.query("DELETE FROM mli_membership_events WHERE organization_id=$1",[id]);
      await client.query("DELETE FROM mli_memberships WHERE organization_id=$1",[id]);
      await client.query("DELETE FROM mli_organizations WHERE id=$1",[id]);
    }
    await client.query("DELETE FROM sessions WHERE sid=ANY($1::text[])",[sessions]);
    await client.query("DELETE FROM users WHERE id=ANY($1::text[])",[ids]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
