import { z } from "zod";
import { closureError, validWeight } from "@workspace/material-accounting";

export const PRESENTATION_KEY = "mli.presentation.v1";
export const WORKER = "presentation-worker";
export const MANAGER = "presentation-manager";
export const TOLERANCE = 0.1;
const weight = z.number().refine(validWeight);
const jobSchema = z.object({
  id: z.string().startsWith("pres-"),
  reference: z.string().max(200), product: z.string().max(200),
  material: z.string().max(200), machine: z.string().max(200),
  issued: weight, good: weight, reusable: weight, rework: weight,
  scrapEntries: z.array(z.object({ reason: z.string().max(200), weight })),
  notes: z.string().max(5000),
  status: z.enum(["draft", "closed"]), createdAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(), tolerance: z.literal(TOLERANCE),
  createdBy: z.enum([WORKER, MANAGER]), assignedTo: z.literal(WORKER).nullable(),
  investigationNotes: z.array(z.object({ id: z.string(), text: z.string().max(5000), createdAt: z.string().datetime() })),
});
export const stateSchema = z.object({
  version: z.literal(1), view: z.enum(["manager", "worker"]), jobs: z.array(jobSchema).max(200),
}).superRefine((s, ctx) => {
  if (new Set(s.jobs.map(j => j.id)).size !== s.jobs.length ||
      s.jobs.some(j => j.status === "closed" && (!j.closedAt || closureError(j, j.tolerance)))) {
    ctx.addIssue({ code: "custom", message: "Invalid presentation records" });
  }
});
export type PresentationJob = z.infer<typeof jobSchema>;
export type PresentationState = z.infer<typeof stateSchema>;
export type PresentationView = PresentationState["view"];
export function seedPresentation(): PresentationState {
  const base = { product: "Presentation boards", material: "Greyboard 2 mm", machine: "PRES-CT-2",
    notes: "", rework: 0, tolerance: TOLERANCE, createdBy: MANAGER, assignedTo: null,
    investigationNotes: [] } as const;
  return stateSchema.parse({ version: 1, view: "manager", jobs: [
    { ...base, id: "pres-001", reference: "PRES-001", issued: 1000, good: 820, reusable: 80,
      scrapEntries: [{ reason: "setup_layout", weight: 100 }], status: "closed",
      createdAt: "2026-10-05T08:00:00Z", closedAt: "2026-10-05T12:00:00Z" },
    { ...base, id: "pres-002", reference: "PRES-002", issued: 1200, good: 900, reusable: 60,
      scrapEntries: [{ reason: "setup_layout", weight: 180 }, { reason: "damaged", weight: 60 }],
      status: "closed", createdAt: "2026-10-07T08:00:00Z", closedAt: "2026-10-07T12:00:00Z" },
    { ...base, id: "pres-003", reference: "PRES-003", issued: 100, good: 80, reusable: 10,
      scrapEntries: [{ reason: "setup_layout", weight: 10 }], assignedTo: WORKER,
      status: "draft", createdAt: "2026-10-08T08:00:00Z", closedAt: null },
    { ...base, id: "pres-004", reference: "PRES-004", issued: 100, good: 75, reusable: 10, rework: 5,
      scrapEntries: [{ reason: "damaged", weight: 10 }], status: "draft",
      createdAt: "2026-10-09T08:00:00Z", closedAt: null,
      investigationNotes: [{ id: "pres-note-1", text: "Synthetic observation: inspect the damaged sheets. Cause not verified.", createdAt: "2026-10-09T09:00:00Z" }] },
  ] });
}
export type PresentationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StorageIssue = "unavailable" | "invalid" | null;
export function loadPresentation(storage: PresentationStorage): { state: PresentationState; issue: StorageIssue } {
  let raw: string | null;
  try { raw = storage.getItem(PRESENTATION_KEY); }
  catch { return { state: seedPresentation(), issue: "unavailable" }; }
  if (raw === null) return { state: seedPresentation(), issue: null };
  try { return { state: stateSchema.parse(JSON.parse(raw)), issue: null }; }
  catch { return { state: seedPresentation(), issue: "invalid" }; }
}
export function savePresentation(storage: PresentationStorage, state: PresentationState) {
  storage.setItem(PRESENTATION_KEY, JSON.stringify(stateSchema.parse(state)));
}
