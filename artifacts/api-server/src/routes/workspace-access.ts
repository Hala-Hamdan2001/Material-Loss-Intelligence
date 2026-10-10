import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, memberships, membershipEvents, organizations, usersTable, materialJobs, materialEvents } from "@workspace/db";
import { ListWorkspacesResponse, ListMembersResponse, SaveMemberBody, SaveMemberResponse, AssignJobBody, AssignJobParams, AssignJobResponse } from "@workspace/api-zod";
import { workspace, fail, getJob } from "../lib/material-store";
import { mutate, requireManager } from "../lib/permissions";

const router: IRouter = Router();
router.get("/workspaces", async (req,res) => {
  if (!req.isAuthenticated()) fail(401,"UNAUTHORIZED");
  const rows = await db.select({id:memberships.organizationId,role:memberships.role}).from(memberships)
    .innerJoin(organizations,eq(organizations.id,memberships.organizationId))
    .where(and(eq(memberships.userId,req.user!.id),eq(memberships.active,true),eq(organizations.isDemo,false)));
  res.json(ListWorkspacesResponse.parse(rows));
});
router.get("/workspace/members", async (req,res) => {
  const org = await workspace(req,res); requireManager(org);
  if (org.isDemo) fail(403,"FORBIDDEN");
  const rows = await db.select({userId:memberships.userId,role:memberships.role,active:memberships.active})
    .from(memberships).where(eq(memberships.organizationId,org.id));
  res.json(ListMembersResponse.parse(rows));
});
router.post("/workspace/members", async (req,res) => {
  const org = await workspace(req,res);
  if (org.isDemo) fail(403,"FORBIDDEN");
  const input = SaveMemberBody.parse(req.body);
  const saved = await mutate(org,true,async tx => {
    const [user] = await tx.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.id,input.userId));
    if (!user) fail(404,"NOT_FOUND");
    const rows = await tx.select().from(memberships).where(eq(memberships.organizationId,org.id));
    const prior = rows.find(m=>m.userId === input.userId);
    if (prior?.active && prior.role === "manager" && (!input.active || input.role !== "manager") &&
      rows.filter(m=>m.active && m.role === "manager").length <= 1) fail(409,"LAST_MANAGER");
    await tx.insert(memberships).values({organizationId:org.id,...input})
      .onConflictDoUpdate({target:[memberships.organizationId,memberships.userId],set:{role:input.role,active:input.active,updatedAt:new Date()}});
    await tx.insert(membershipEvents).values({id:randomUUID(),organizationId:org.id,actorId:org.userId!,...input});
    return input;
  });
  res.json(SaveMemberResponse.parse(saved));
});
router.post("/jobs/:id/assignment", async (req,res) => {
  const {id} = AssignJobParams.parse(req.params);
  const input = AssignJobBody.parse(req.body);
  const org = await workspace(req,res);
  if (org.isDemo) fail(403,"FORBIDDEN");
  await mutate(org,true,async tx => {
    const [job] = await tx.select().from(materialJobs).where(and(eq(materialJobs.id,id),eq(materialJobs.organizationId,org.id)));
    if (!job) fail(404,"NOT_FOUND");
    if (input.assignedTo !== null) {
      const [member] = await tx.select().from(memberships).where(and(eq(memberships.organizationId,org.id),eq(memberships.userId,input.assignedTo),eq(memberships.active,true)));
      if (!member) fail(400,"INVALID_ASSIGNEE");
    }
    const [saved] = await tx.update(materialJobs).set({assignedTo:input.assignedTo,revision:sql`${materialJobs.revision} + 1`})
      .where(and(eq(materialJobs.id,id),eq(materialJobs.organizationId,org.id),eq(materialJobs.revision,input.revision))).returning();
    if (!saved) fail(409,"STALE_REVISION");
    await tx.insert(materialEvents).values({id:randomUUID(),jobId:id,kind:"assign",text:input.assignedTo ?? "",actorId:org.userId,revision:saved.revision});
  });
  res.json(AssignJobResponse.parse(await getJob(org,id)));
});
export default router;
