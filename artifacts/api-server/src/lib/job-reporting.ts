import type { JobView } from "./material-store";

export function boardJobs(jobs: JobView[]) {
  const result: { jobs: JobView[]; investigation: JobView[]; closed: JobView[] } = { jobs: [], investigation: [], closed: [] };
  for (const job of jobs) {
    const investigate = job.investigationNotes.length > 0 ||
      job.signals.some(s => s === "high_scrap" || s === "above_baseline");
    result[investigate ? "investigation" : job.status === "closed" ? "closed" : "jobs"].push(job);
  }
  return result;
}

export function filterJobs(jobs: JobView[], q: {search?: string; machine?: string; material?: string; status?: string; from?: string; to?: string}) {
  return jobs.filter(j => {
    const date = (j.closedAt ?? j.createdAt).slice(0,10);
    return (!q.search || j.reference.toLocaleLowerCase().includes(q.search.toLocaleLowerCase())) &&
      (!q.machine || j.machine === q.machine) && (!q.material || j.material === q.material) &&
      (!q.status || j.status === q.status) && (!q.from || date >= q.from) && (!q.to || date <= q.to);
  });
}

/** Quote every cell; guard formula-like text even after leading whitespace. */
export function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (typeof value === "string" && (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function jobsCsv(jobs: JobView[], language: "en" | "ar" = "en") {
  const headers = language === "ar" ? [
    "رقم الأمر", "تاريخ الإنشاء", "المنتج", "المادة", "الآلة",
    "الوزن المصروف (كغ)", "الإنتاج السليم (كغ)", "الخردة (كغ)", "أسباب الخردة (كغ)",
    "القصاصات القابلة لإعادة الاستخدام (كغ)", "إعادة التشغيل (كغ)", "المردود (%)", "نسبة الخردة (%)",
    "الحالة المحاسبية", "تاريخ الإغلاق",
  ] : [
    "Job number", "Created date", "Product", "Material", "Machine",
    "Issued (kg)", "Good output (kg)", "Scrap (kg)", "Scrap reasons (kg)",
    "Reusable offcuts (kg)", "Rework (kg)", "Yield (%)", "Scrap (%)",
    "Accounting status", "Closed date",
  ];
  const rows: (string | number | null)[][] = [headers, ...jobs.map(j => [
    j.reference, j.createdAt, j.product, j.material, j.machine, j.issued, j.good,
    j.metrics.scrap, j.scrapEntries.map(e => `${e.reason}: ${e.weight}`).join("; "),
    j.reusable, j.rework, j.metrics.yieldPercent, j.metrics.scrapPercent,
    j.status, j.closedAt,
  ])];
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
