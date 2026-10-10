import { and, eq, or } from "drizzle-orm";
import { db, organizations, memberships, materialJobs, type Organization } from "@workspace/db";

export type Access = Organization & { role: "demo" | "manager" | "worker"; userId: string | null };
export const forbidden = (): never => { throw Object.assign(new Error("FORBIDDEN"), { status: 403 }); };
export function requireManager(access: Access) {
  if (access.role !== "demo" && access.role !== "manager") forbidden();
}
export async function resolveAccess(org: Organization, userId?: string): Promise<Access> {
  if (org.isDemo) return { ...org, role: "demo", userId: null };
  if (!userId) forbidden();
  const [member] = await db.select().from(memberships).where(and(
    eq(memberships.organizationId, org.id), eq(memberships.userId, userId!), eq(memberships.active, true),
  ));
  if (!member) forbidden();
  return { ...org, role: member.role, userId: userId! };
}
export function jobScope(access: Access) {
  return and(eq(materialJobs.organizationId, access.id),
    access.role === "worker" ? or(
      eq(materialJobs.createdBy, access.userId!), eq(materialJobs.assignedTo, access.userId!),
    ) : undefined);
}
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Serialize private mutations with membership/assignment changes; recheck under the lock. */
export async function mutate<T>(access: Access, managerOnly: boolean, fn: (tx: Transaction, current: Access) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    let current = access;
    if (!access.isDemo) {
      await tx.select().from(organizations).where(eq(organizations.id, access.id)).for("update");
      const [member] = await tx.select().from(memberships).where(and(
        eq(memberships.organizationId, access.id), eq(memberships.userId, access.userId!), eq(memberships.active, true),
      ));
      if (!member) forbidden();
      access.role = member.role;
      current = { ...access, role: member.role };
    }
    if (managerOnly) requireManager(current);
    return fn(tx, current);
  });
}
