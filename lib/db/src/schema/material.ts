import { pgTable, text, boolean, numeric, integer, timestamp, jsonb, uniqueIndex, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";
import { createInsertSchema } from "drizzle-zod";

export const organizations = pgTable("mli_organizations", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id"),
  isDemo: boolean("is_demo").notNull().default(false),
  tolerance: numeric("tolerance", { precision: 12, scale: 3 }).notNull().default("0.100"),
  highScrapThreshold: numeric("high_scrap_threshold", { precision: 6, scale: 3 }).notNull().default("15"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const materialJobs = pgTable("mli_jobs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  reference: text("reference").notNull(), product: text("product").notNull(),
  material: text("material").notNull(), machine: text("machine").notNull(),
  issued: numeric("issued", { precision: 14, scale: 3 }).notNull(),
  good: numeric("good", { precision: 14, scale: 3 }).notNull(),
  reusable: numeric("reusable", { precision: 14, scale: 3 }).notNull(),
  rework: numeric("rework", { precision: 14, scale: 3 }).notNull(),
  scrapEntries: jsonb("scrap_entries").$type<{reason: string; weight: number}[]>().notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  tolerance: numeric("tolerance", { precision: 12, scale: 3 }).notNull().default("0.100"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => usersTable.id),
  assignedTo: text("assigned_to").references(() => usersTable.id),
}, (t) => [uniqueIndex("mli_job_reference_org").on(t.organizationId, t.reference)]);
export const materialEvents = pgTable("mli_events", {
  id: text("id").primaryKey(), jobId: text("job_id").notNull().references(() => materialJobs.id),
  kind: text("kind").notNull(), text: text("text").notNull(), actorId: text("actor_id"),
  revision: integer("revision").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const materialInsights = pgTable("mli_insights", {
  id: text("id").primaryKey(), jobId: text("job_id").notNull().references(() => materialJobs.id),
  revision: integer("revision").notNull(), language: text("language").notNull(),
  comparisonId: text("comparison_id").notNull(), text: text("text").notNull(), source: text("source").notNull(),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertMaterialJobSchema = createInsertSchema(materialJobs);
export type MaterialJobRow = typeof materialJobs.$inferSelect;
export type Organization = typeof organizations.$inferSelect;

export const memberships = pgTable("mli_memberships", {
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  role: text("role").$type<"manager" | "worker">().notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.organizationId, t.userId] }),
  check("mli_membership_role", sql`${t.role} in ('manager', 'worker')`),
]);
export const membershipEvents = pgTable("mli_membership_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  actorId: text("actor_id").notNull().references(() => usersTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull(),
  active: boolean("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
