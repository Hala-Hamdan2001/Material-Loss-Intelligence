import { createHash, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, inArray, asc } from "drizzle-orm";
import { db, organizations, materialJobs, materialEvents, memberships, type MaterialJobRow } from "@workspace/db";
import { resolveAccess, jobScope, type Access } from "./permissions";
import { calculate, baseline, validWeight } from "@workspace/material-accounting";
import type { z } from "zod";
import { CreateJobBody } from "@workspace/api-zod";

export const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };
export type JobInput = z.infer<typeof CreateJobBody>;
export const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 30 * 86400000 };
export async function workspace(req: Request, res: Response): Promise<Access> {
  const privateMode = req.cookies?.mli_mode === "private";
  let id: string;
  if (privateMode) {
    if (!req.isAuthenticated()) fail(401, "UNAUTHORIZED");
    id = req.cookies?.mli_workspace || "factory_" + createHash("sha256").update(req.user!.id).digest("hex");
  } else {
    let token = req.cookies?.mli_demo;
    if (typeof token !== "string" || !/^[0-9a-f-]{36}$/.test(token)) {
      token = randomUUID();
      res.cookie("mli_demo", token, cookieOptions);
    }
    id = "demo_" + createHash("sha256").update(token).digest("hex");
  }
  const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (existing) {
    if (existing.isDemo === privateMode) fail(403, "FORBIDDEN");
    return resolveAccess(existing, privateMode ? req.user?.id : undefined);
  }
  if (privateMode && req.cookies?.mli_workspace) fail(403, "FORBIDDEN");
  const org = await db.transaction(async tx => {
    const [created] = await tx.insert(organizations).values({
      id, isDemo: !privateMode, ownerId: privateMode ? req.user!.id : null,
    }).onConflictDoNothing().returning();
    if (!created) {
      const [found] = await tx.select().from(organizations).where(eq(organizations.id, id));
      return found!;
    }
    if (!privateMode) {
      const common = { organizationId: id, product: "Book cover boards", material: "Greyboard 2 mm", machine: "CT-2", rework: "0", notes: "", tolerance: "0.1", revision: 1 };
      await tx.insert(materialJobs).values([
        { ...common, id: randomUUID(), reference: "IK-203", issued: "1000", good: "820", reusable: "80", scrapEntries: [{ reason: "unspecified_demo", weight: 100 }], status: "closed", createdAt: new Date("2026-10-06T08:00:00Z"), closedAt: new Date("2026-10-06T12:00:00Z") },
        { ...common, id: randomUUID(), reference: "IK-202", issued: "1200", good: "900", reusable: "60", scrapEntries: [{ reason: "setup_layout", weight: 180 }, { reason: "damaged", weight: 60 }], status: "closed", createdAt: new Date("2026-10-07T08:00:00Z"), closedAt: new Date("2026-10-07T12:00:00Z") },
        { ...common, id: randomUUID(), reference: "IK-204", issued: "800", good: "620", reusable: "50", scrapEntries: [{ reason: "setup_layout", weight: 90 }], status: "draft", createdAt: new Date("2026-10-08T08:00:00Z") },
      ]);
    } else {
      await tx.insert(memberships).values({ organizationId: id, userId: req.user!.id, role: "manager" });
    }
    return created;
  });
  return resolveAccess(org, privateMode ? req.user?.id : undefined);
}
export const workspaceView = (org: Access) => ({
  id: org.id, isDemo: org.isDemo, tolerance: Number(org.tolerance),
  highScrapThreshold: Number(org.highScrapThreshold), baselineGap: 5,
  role: org.role, userId: org.userId,
});
export function serialize(row: MaterialJobRow, org: Access) {
  return {
    id: row.id, reference: row.reference, product: row.product, material: row.material, machine: row.machine,
    issued: Number(row.issued), good: Number(row.good), reusable: Number(row.reusable), rework: Number(row.rework),
    scrapEntries: row.scrapEntries, notes: row.notes,
    status: row.status as "draft" | "closed", revision: row.revision,
    tolerance: Number(row.status === "closed" ? row.tolerance : org.tolerance),
    createdAt: row.createdAt.toISOString(), closedAt: row.closedAt?.toISOString() ?? null, isDemo: org.isDemo,
    createdBy: row.createdBy, assignedTo: row.assignedTo,
  };
}
export async function allJobs(org: Access) {
  const rows = await db.select().from(materialJobs).where(jobScope(org));
  const base = rows.map(row => serialize(row, org));
  const events = rows.length && org.role !== "worker" ? await db.select().from(materialEvents)
    .where(and(inArray(materialEvents.jobId, rows.map(j => j.id)), eq(materialEvents.kind, "note")))
    .orderBy(asc(materialEvents.createdAt)) : [];
  return base.map(j => {
    const metrics = calculate(j, j.tolerance);
    const b = org.role === "worker" ? null : baseline(j, base);
    const signals: ("high_scrap" | "above_baseline" | "insufficient_history")[] = [];
    if (j.status === "closed" && b) {
      if (metrics.scrapPercent > Number(org.highScrapThreshold)) signals.push("high_scrap");
      if (b.sufficient && b.difference !== null && b.difference > 5) signals.push("above_baseline");
      if (!b.sufficient) signals.push("insufficient_history");
    }
    return { ...j, metrics, signals,
      investigationNotes: events.filter(e => e.jobId === j.id).map(e => ({ id: e.id, text: e.text, createdAt: e.createdAt.toISOString() })),
    };
  }).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export type JobView = Awaited<ReturnType<typeof allJobs>>[number];
export async function getJob(org: Access, id: string): Promise<JobView> {
  const j = (await allJobs(org)).find(j => j.id === id);
  return j ?? fail(404, "NOT_FOUND");
}
export function validateInput(input: JobInput) {
  if (![input.issued, input.good, input.reusable, input.rework, ...input.scrapEntries.map(s => s.weight)].every(validWeight)) fail(400, "INVALID_WEIGHT");
  if (!input.reference.trim() || input.scrapEntries.length > 100 ||
      [input.product, input.material, input.machine].some(s => s.length > 200) ||
      input.notes.length > 4000 || input.scrapEntries.some(s => s.reason.length > 200 || (s.weight > 0 && !s.reason.trim()))) fail(400, "INVALID_INPUT");
}
export function writeValues(input: JobInput) {
  return { reference: input.reference.trim(), product: input.product, material: input.material, machine: input.machine,
    issued: input.issued.toFixed(3), good: input.good.toFixed(3), reusable: input.reusable.toFixed(3),
    rework: input.rework.toFixed(3), scrapEntries: input.scrapEntries, notes: input.notes };
}
