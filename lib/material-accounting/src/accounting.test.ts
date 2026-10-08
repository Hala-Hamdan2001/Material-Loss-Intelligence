import test from "node:test";
import assert from "node:assert/strict";
import { calculate, closureError, aggregate, baseline, previousJobs, validWeight } from "./index.ts";

const common = { machine:"CT-2",product:"Board",material:"Greyboard",tolerance:0.1,rework:0,status:"closed",createdAt:"2026-10-07T08:00:00Z" };
const ik202 = { ...common,id:"202",reference:"IK-202",issued:1200,good:900,reusable:60,scrapEntries:[{reason:"setup_layout",weight:180},{reason:"damaged",weight:60}],closedAt:"2026-10-07T12:00:00Z" };
const ik203 = { ...common,id:"203",reference:"IK-203",issued:1000,good:820,reusable:80,scrapEntries:[{reason:"unspecified_demo",weight:100}],closedAt:"2026-10-06T12:00:00Z" };
test("IK-202 exact yield, scrap, reusable, setup contribution and balance", () => {
  const m=calculate(ik202);
  assert.equal(m.yieldPercent,75); assert.equal(m.scrapPercent,20); assert.equal(m.reusablePercent,5);
  assert.equal(m.scrap,240); assert.equal(m.largestWeight,180); assert.equal(m.largestContribution,75);
  assert.equal(m.largestReason,"setup_layout"); assert.equal(m.residual,0); assert.equal(m.balanced,true);
});
test("IK-203 and ten percentage point difference",()=> {
  assert.equal(calculate(ik203).yieldPercent,82); assert.equal(calculate(ik203).scrapPercent,10);
  assert.equal(calculate(ik202).scrapPercent-calculate(ik203).scrapPercent,10);
  assert.equal(calculate(ik203).scrap,100);
});
test("unbalanced job cannot close, and missing weights are never normalized",()=>{
  const bad={...ik202,good:880};
  assert.equal(closureError(bad),"UNBALANCED"); assert.equal(calculate(bad).residual,20);
  assert.equal(calculate(bad).scrap,240);
});
test("negative, nonfinite, zero issued and overprecision rejected",()=>{
  assert.equal(closureError({...ik202,good:-1}),"INVALID_WEIGHT");
  assert.equal(closureError({...ik202,good:NaN}),"INVALID_WEIGHT");
  assert.equal(closureError({...ik202,issued:0}),"ZERO_ISSUED");
  assert.equal(validWeight(0.0001),false);
  assert.equal(validWeight(Infinity),false);
});
test("absolute tolerance accepts exact boundary both ways but not excess",()=>{
  assert.equal(closureError({...ik202,good:899.9}),null);
  assert.equal(closureError({...ik202,good:900.1}),null);
  assert.equal(closureError({...ik202,good:899.899}),"UNBALANCED");
  assert.equal(closureError({...ik202,good:900.101}),"UNBALANCED");
  assert.equal(calculate({...ik202,good:899.9}).residual,0.1);
});
test("rework is separate, duplicate reasons aggregate, required identifiers enforced",()=>{
  assert.equal(calculate({...ik202,good:850,rework:50}).scrap,240);
  assert.equal(closureError({...ik202,good:850,rework:50}),null);
  assert.equal(calculate({...ik202,scrapEntries:[{reason:"setup",weight:90},{reason:"setup",weight:90},{reason:"damaged",weight:60}]}).largestWeight,180);
  assert.equal(closureError({...ik202,machine:""}),"REQUIRED_FIELDS");
});
test("weighted dashboard and valid closed jobs only",()=>{
  const a=aggregate([ik202,ik203,{...ik202,id:"draft",status:"draft"},{...ik202,id:"invalid",good:800}]);
  assert.equal(a.totalJobs,2); assert.equal(a.draftCount,1);
  assert.equal(a.issued,2200); assert.equal(a.good,1720); assert.equal(a.scrap,340); assert.equal(a.reusable,140);
  assert.equal(a.scrapPercent,340/2200*100); assert.equal(a.yieldPercent,1720/2200*100);
});
test("direct comparison only previous valid closed same-machine jobs",()=>{
  const pool=[ik202,ik203,{...ik203,id:"wrong-machine",machine:"CT-3"},{...ik203,id:"future",closedAt:"2026-10-08T00:00:00Z"},{...ik203,id:"draft",status:"draft"}];
  assert.deepEqual(previousJobs(ik202,pool).map(j=>j.id),["203"]);
});
test("insufficient history is explicit, no cohort broadening",()=>{
  const b=baseline(ik202,[ik202,ik203,...Array.from({length:6},(_,i)=>({...ik203,id:`x${i}`,product:"Different"}))]);
  assert.equal(b.sufficient,false); assert.equal(b.count,1); assert.equal(b.scrapPercent,null); assert.equal(b.difference,null);
});
test("five matching jobs qualify; outside 90 days/current excluded",()=>{
  const pool=Array.from({length:5},(_,i)=>({...ik203,id:`h${i}`}));
  const b=baseline(ik202,[ik202,...pool,{...ik203,id:"old",closedAt:"2026-01-01T00:00:00Z"}]);
  assert.equal(b.count,5); assert.equal(b.sufficient,true); assert.equal(b.scrapPercent,10); assert.equal(b.difference,10);
});
