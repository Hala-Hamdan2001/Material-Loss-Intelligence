export interface MaterialInput {
  issued: number; good: number; reusable: number; rework: number;
  scrapEntries: { reason: string; weight: number }[];
}
export interface HistoricalJob extends MaterialInput {
  id: string; status: string; machine: string; material: string; product: string;
  createdAt: string; closedAt: string | null; tolerance: number;
}
// All accepted weights have at most three decimal places. Integer grams make
// balancing exact without IEEE floating-point residuals at the tolerance edge.
export const grams = (value: number) => Math.round(value * 1000);
export const percent = (part: number, total: number) => total > 0 ? part / total * 100 : 0;
export function validWeight(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100000000
    && Math.abs(value * 1000 - grams(value)) < 0.0001;
}
export function calculate(input: MaterialInput, tolerance = 0.1) {
  const categories = new Map<string, number>();
  for (const entry of input.scrapEntries) {
    categories.set(entry.reason, (categories.get(entry.reason) ?? 0) + grams(entry.weight));
  }
  const ranked = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  const scrapGrams = ranked.reduce((sum, [, weight]) => sum + weight, 0);
  const accounted = grams(input.good) + grams(input.reusable) + grams(input.rework) + scrapGrams;
  const residual = grams(input.issued) - accounted;
  return {
    scrap: scrapGrams / 1000, accounted: accounted / 1000, residual: residual / 1000,
    yieldPercent: percent(grams(input.good), grams(input.issued)),
    scrapPercent: percent(scrapGrams, grams(input.issued)),
    reusablePercent: percent(grams(input.reusable), grams(input.issued)),
    reworkPercent: percent(grams(input.rework), grams(input.issued)),
    balanced: Math.abs(residual) <= grams(tolerance),
    largestReason: ranked[0]?.[0] ?? "", largestWeight: (ranked[0]?.[1] ?? 0) / 1000,
    largestContribution: percent(ranked[0]?.[1] ?? 0, scrapGrams),
  };
}
export function closureError(input: MaterialInput & { reference: string; machine: string; material: string; product: string }, tolerance = 0.1): string | null {
  if (![input.issued, input.good, input.reusable, input.rework, ...input.scrapEntries.map(s => s.weight)].every(validWeight)) return "INVALID_WEIGHT";
  if (![input.reference, input.machine, input.material, input.product].every(x => x.trim()) ||
      input.scrapEntries.some(s => s.weight > 0 && !s.reason.trim())) return "REQUIRED_FIELDS";
  if (input.issued <= 0) return "ZERO_ISSUED";
  if (!calculate(input, tolerance).balanced) return "UNBALANCED";
  return null;
}
export function isValidClosed(job: HistoricalJob) {
  return job.status === "closed" && !!job.closedAt && job.issued > 0 &&
    [job.issued, job.good, job.reusable, job.rework, ...job.scrapEntries.map(s => s.weight)].every(validWeight) &&
    calculate(job, job.tolerance).balanced;
}
export function previousJobs<T extends HistoricalJob>(job: T, jobs: T[]): T[] {
  const end = new Date(job.closedAt ?? job.createdAt).getTime();
  return jobs.filter(j => j.id !== job.id && j.machine === job.machine && isValidClosed(j) &&
    new Date(j.closedAt!).getTime() < end).sort((a,b) => Date.parse(b.closedAt!) - Date.parse(a.closedAt!));
}
export function baseline<T extends HistoricalJob>(job: T, jobs: T[]) {
  const end = Date.parse(job.closedAt ?? job.createdAt);
  const matches = previousJobs(job, jobs).filter(j => j.material === job.material && j.product === job.product &&
    Date.parse(j.closedAt!) >= end - 90 * 86400000);
  const sufficient = matches.length >= 5;
  const issued = matches.reduce((sum, j) => sum + grams(j.issued), 0);
  const scrap = matches.reduce((sum, j) => sum + grams(calculate(j).scrap), 0);
  const scrapPercent = sufficient ? percent(scrap, issued) : null;
  return { sufficient, count: matches.length, scrapPercent,
    difference: scrapPercent === null ? null : calculate(job).scrapPercent - scrapPercent, days: 90 };
}
export function aggregate<T extends HistoricalJob>(jobs: T[]) {
  const valid = jobs.filter(isValidClosed);
  const sums = { issued: 0, good: 0, scrap: 0, reusable: 0, rework: 0 };
  const reasons = new Map<string, number>();
  for (const j of valid) {
    for (const key of ["issued", "good", "reusable", "rework"] as const) sums[key] += grams(j[key]);
    for (const e of j.scrapEntries) {
      sums.scrap += grams(e.weight);
      reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + grams(e.weight));
    }
  }
  return {
    totalJobs: valid.length, draftCount: jobs.filter(j => j.status === "draft").length,
    issued: sums.issued / 1000, good: sums.good / 1000, scrap: sums.scrap / 1000,
    reusable: sums.reusable / 1000, rework: sums.rework / 1000,
    yieldPercent: percent(sums.good, sums.issued), scrapPercent: percent(sums.scrap, sums.issued),
    scrapReasons: [...reasons].map(([reason, weight]) => ({ reason, weight: weight / 1000, contribution: percent(weight, sums.scrap) })).sort((a,b) => b.weight - a.weight),
  };
}
