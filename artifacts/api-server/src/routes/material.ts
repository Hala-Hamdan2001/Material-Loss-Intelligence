import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, materialJobs, materialEvents, organizations } from "@workspace/db";
import {
  CreateJobBody, UpdateJobBody, CloseJobBody, ReopenJobBody, AddInvestigationNoteBody,
  SwitchWorkspaceBody, UpdateSettingsBody, GetJobParams, GetComparisonQueryParams, ListJobsQueryParams,
  GetDashboardQueryParams, GetWorkspaceResponse, GetReferenceDataResponse, GetDashboardResponse,
  ListJobsResponse, GetJobResponse, GetComparisonResponse,
} from "@workspace/api-zod";
import { aggregate, baseline, closureError, previousJobs, validWeight } from "@workspace/material-accounting";
import { allJobs, getJob, workspace, workspaceView, fail, writeValues, validateInput, cookieOptions } from "../lib/material-store";
import insightRouter from "./material-insights";
import accessRouter from "./workspace-access";
import { mutate, requireManager, jobScope } from "../lib/permissions";
import { performanceJobs } from "../lib/dashboard-performance";

const router: IRouter = Router();
router.use(accessRouter);
router.get("/workspace", async (req, res) => { res.json(GetWorkspaceResponse.parse(workspaceView(await workspace(req,res)))); });
router.post("/workspace", async (req, res) => {
  const { mode, workspaceId } = SwitchWorkspaceBody.parse(req.body);
  if (mode === "private" && !req.isAuthenticated()) fail(401, "UNAUTHORIZED");
  req.cookies.mli_mode = mode;
  if (mode === "private") {
    if (workspaceId) req.cookies.mli_workspace = workspaceId;
    else delete req.cookies.mli_workspace;
  }
  const next = await workspace(req,res);
  res.cookie("mli_mode", mode, cookieOptions);
  if (mode === "private") res.cookie("mli_workspace", next.id, cookieOptions);
  else res.clearCookie("mli_workspace", { path: "/" });
  res.json(GetWorkspaceResponse.parse(workspaceView(next)));
});
router.patch("/workspace/settings", async (req, res) => {
  const input = UpdateSettingsBody.parse(req.body);
  if (!validWeight(input.tolerance) || !validWeight(input.highScrapThreshold)) fail(400, "INVALID_INPUT");
  const org = await workspace(req,res);
  const saved = await mutate(org, true, async tx => {
    const [row] = await tx.update(organizations).set({ tolerance: String(input.tolerance), highScrapThreshold: String(input.highScrapThreshold) }).where(eq(organizations.id, org.id)).returning();
    return row!;
  });
  res.json(GetWorkspaceResponse.parse(workspaceView({ ...org, ...saved })));
});
router.get("/reference-data", async (req,res) => {
  const org = await workspace(req,res);
  const jobs = await allJobs(org);
  const unique = (key: "machine" | "material" | "product") => [...new Set(jobs.map(j => j[key]).filter(Boolean))];
  res.json(GetReferenceDataResponse.parse({ machines: unique("machine"), materials: unique("material"), products: unique("product"),
    scrapReasons: [...new Set(["setup_layout", "damaged", ...jobs.flatMap(j => j.scrapEntries.map(e => e.reason)).filter(r => r !== "unspecified_demo")])] }));
});
function validateDate(value: string | undefined) {
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)))) fail(400, "INVALID_INPUT");
}
router.get("/dashboard", async (req,res) => {
  const { from, to } = GetDashboardQueryParams.parse(req.query); validateDate(from); validateDate(to);
  const org = await workspace(req,res); requireManager(org);
  const jobs = await allJobs(org);
  const filtered = jobs.filter(j => {
    const date = (j.closedAt ?? j.createdAt).slice(0,10);
    return (!from || date >= from) && (!to || date <= to);
  });
  res.json(GetDashboardResponse.parse({ ...aggregate(filtered), recentJobs: filtered.slice(0,6), performanceJobs: performanceJobs(filtered),
    attentionJobs: filtered.filter(j => j.status === "closed" && j.signals.some(s => s !== "insufficient_history")) }));
});
router.get("/jobs", async (req,res) => {
  const q = ListJobsQueryParams.parse(req.query); validateDate(q.from); validateDate(q.to);
  const jobs = await allJobs(await workspace(req,res));
  res.json(ListJobsResponse.parse(jobs.filter(j => {
    const date = (j.closedAt ?? j.createdAt).slice(0,10);
    return (!q.search || j.reference.toLocaleLowerCase().includes(q.search.toLocaleLowerCase())) &&
      (!q.machine || j.machine === q.machine) && (!q.material || j.material === q.material) &&
      (!q.status || j.status === q.status) && (!q.from || date >= q.from) && (!q.to || date <= q.to);
  })));
});
router.post("/jobs", async (req,res) => {
  const input = CreateJobBody.parse(req.body); validateInput(input);
  const org = await workspace(req,res); const id = randomUUID();
  await mutate(org, false, async (tx, current) => {
    await tx.insert(materialJobs).values({ ...writeValues(input), id, organizationId: org.id, tolerance: org.tolerance, createdBy: current.userId });
  });
  res.status(201).json(GetJobResponse.parse(await getJob(org,id)));
});
router.get("/jobs/:id", async (req,res) => {
  const {id} = GetJobParams.parse(req.params);
  res.json(GetJobResponse.parse(await getJob(await workspace(req,res),id)));
});
router.patch("/jobs/:id", async (req,res) => {
  const {id} = GetJobParams.parse(req.params); const input = UpdateJobBody.parse(req.body); validateInput(input);
  const org = await workspace(req,res); const existing = await getJob(org,id);
  if (existing.status === "closed") fail(409,"CLOSED_JOB");
  await mutate(org, false, async (tx, current) => {
    const [visible] = await tx.select({ id: materialJobs.id }).from(materialJobs).where(and(eq(materialJobs.id,id),jobScope(current)));
    if (!visible) fail(404,"NOT_FOUND");
    const [saved] = await tx.update(materialJobs).set({ ...writeValues(input), revision: sql`${materialJobs.revision} + 1` })
      .where(and(eq(materialJobs.id,id),jobScope(current),eq(materialJobs.status,"draft"),eq(materialJobs.revision,input.revision))).returning();
    if (!saved) fail(409,"STALE_REVISION");
  });
  res.json(GetJobResponse.parse(await getJob(org,id)));
});
router.post("/jobs/:id/close", async (req,res) => {
  const {id} = GetJobParams.parse(req.params); const input = CloseJobBody.parse(req.body);
  const org = await workspace(req,res); const job = await getJob(org,id);
  requireManager(org);
  if (job.status !== "draft") fail(409,"CLOSED_JOB");
  const error = closureError(job, Number(org.tolerance)); if (error) fail(400,error);
  if (job.revision !== input.revision) fail(409,"STALE_REVISION");
  await mutate(org, true, async tx => {
    const [saved] = await tx.update(materialJobs).set({ status:"closed",closedAt:new Date(),tolerance:org.tolerance,revision:sql`${materialJobs.revision} + 1` })
      .where(and(eq(materialJobs.id,id),eq(materialJobs.organizationId,org.id),eq(materialJobs.status,"draft"),eq(materialJobs.revision,input.revision))).returning();
    if (!saved) fail(409,"STALE_REVISION");
    await tx.insert(materialEvents).values({id:randomUUID(),jobId:id,kind:"close",text:"",revision:saved!.revision,actorId:req.user?.id});
  });
  res.json(GetJobResponse.parse(await getJob(org,id)));
});
router.post("/jobs/:id/reopen", async (req,res) => {
  const {id} = GetJobParams.parse(req.params); const input = ReopenJobBody.parse(req.body);
  if (!input.reason.trim()) fail(400,"NOTE_REQUIRED");
  const org = await workspace(req,res); await getJob(org,id);
  await mutate(org, true, async tx => {
    const [saved] = await tx.update(materialJobs).set({status:"draft",closedAt:null,revision:sql`${materialJobs.revision} + 1`})
      .where(and(eq(materialJobs.id,id),eq(materialJobs.organizationId,org.id),eq(materialJobs.status,"closed"),eq(materialJobs.revision,input.revision))).returning();
    if (!saved) fail(409,"STALE_REVISION");
    await tx.insert(materialEvents).values({id:randomUUID(),jobId:id,kind:"reopen",text:input.reason,revision:saved!.revision,actorId:req.user?.id});
  });
  res.json(GetJobResponse.parse(await getJob(org,id)));
});
router.post("/jobs/:id/notes", async (req,res) => {
  const {id} = GetJobParams.parse(req.params); const input = AddInvestigationNoteBody.parse(req.body);
  if (!input.text.trim()) fail(400,"NOTE_REQUIRED");
  const org = await workspace(req,res); await getJob(org,id);
  await mutate(org, true, async tx => {
    const [saved] = await tx.update(materialJobs).set({revision:sql`${materialJobs.revision} + 1`})
      .where(and(eq(materialJobs.id,id),eq(materialJobs.organizationId,org.id))).returning();
    await tx.insert(materialEvents).values({id:randomUUID(),jobId:id,kind:"note",text:input.text,revision:saved!.revision,actorId:req.user?.id});
  });
  res.json(GetJobResponse.parse(await getJob(org,id)));
});
router.get("/jobs/:id/comparison", async (req,res) => {
  const {id} = GetJobParams.parse(req.params); const {comparisonId} = GetComparisonQueryParams.parse(req.query);
  const org = await workspace(req,res); requireManager(org); const jobs = await allJobs(org);
  const job = jobs.find(j => j.id === id) ?? fail(404,"NOT_FOUND");
  const candidates = previousJobs(job,jobs);
  const selected = comparisonId ? candidates.find(j => j.id === comparisonId) ?? fail(400,"INVALID_COMPARISON") : candidates[0] ?? null;
  res.json(GetComparisonResponse.parse({ candidates,selected,difference:selected ? job.metrics.scrapPercent - selected.metrics.scrapPercent : null,baseline:baseline(job,jobs) }));
});
router.use(insightRouter);
export default router;
