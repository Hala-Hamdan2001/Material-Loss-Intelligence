import type { JobView } from "./material-store";
import type { baseline } from "@workspace/material-accounting";

const reasons: Record<string, [string,string]> = {
  setup_layout: ["setup/layout", "الإعداد وتخطيط القص"],
  damaged: ["damaged material", "المواد التالفة"],
  unspecified_demo: ["unspecified demo scrap", "هدر غير محدد في البيانات التجريبية"],
};
export const promptCodes = ["review_setup", "review_damage", "review_records", "compare_requirements", "verify_notes"] as const;
export type PromptCode = typeof promptCodes[number];
const prompts: Record<PromptCode,[string,string]> = {
  review_setup: ["Review the setup/layout records and cutting requirements.", "راجع سجلات الإعداد وتخطيط القص ومتطلبات القص."],
  review_damage: ["Review when damaged material was recorded and the accompanying observations.", "راجع وقت تسجيل المواد التالفة والملاحظات المرافقة."],
  review_records: ["Review the recorded scrap categories and weighing records.", "راجع تصنيفات الهدر المسجلة وسجلات الوزن."],
  compare_requirements: ["Compare product specifications and batch requirements before interpreting the difference.", "قارن مواصفات المنتج ومتطلبات الدفعة قبل تفسير الفرق."],
  verify_notes: ["Check the investigation notes against production records; notes are unverified user-entered evidence.", "تحقق من ملاحظات التحقيق بمقارنتها بسجلات الإنتاج؛ فهي أدلة أدخلها المستخدم ولم يتم التحقق منها."],
};
export function allowedPrompts(job: JobView, comparison: JobView | null): PromptCode[] {
  return ["review_records", ...(job.metrics.largestReason === "setup_layout" ? ["review_setup" as const] : []),
    ...(job.metrics.largestReason === "damaged" ? ["review_damage" as const] : []),
    ...(comparison ? ["compare_requirements" as const] : []),
    ...(job.notes || job.investigationNotes.length ? ["verify_notes" as const] : [])];
}
export function summary(job: JobView, comparison: JobView | null, historical: ReturnType<typeof baseline>, language: "en"|"ar", selected: PromptCode[]) {
  const ar = language === "ar", index = ar ? 1 : 0;
  const n = (v:number) => new Intl.NumberFormat(ar ? "ar" : "en", { maximumFractionDigits: 2 }).format(v);
  const m = job.metrics;
  const reason = reasons[m.largestReason]?.[index] ?? m.largestReason;
  const reference = `\u2068${job.reference}\u2069`;
  const lines = [ar
    ? `سجلت المهمة ${reference} هدرًا قدره ${n(m.scrap)} كغ، أي ${n(m.scrapPercent)}٪ من المواد المصروفة. المردود الجيد ${n(m.yieldPercent)}٪، والقصاصات القابلة لإعادة الاستخدام ${n(job.reusable)} كغ ولا تُحتسب ضمن الهدر.`
    : `${reference} recorded ${n(m.scrap)} kg of scrap (${n(m.scrapPercent)}% of issued material). Good yield is ${n(m.yieldPercent)}%. The ${n(job.reusable)} kg of reusable offcuts is excluded from scrap.`];
  if (m.scrap > 0) lines.push(ar
    ? `أكبر فئة هدر مسجلة هي \u2068${reason}\u2069 بوزن ${n(m.largestWeight)} كغ، وتمثل ${n(m.largestContribution)}٪ من إجمالي الهدر.`
    : `The largest recorded scrap category is ${reason}: ${n(m.largestWeight)} kg, accounting for ${n(m.largestContribution)}% of total scrap.`);
  if (comparison) {
    const delta = m.scrapPercent - comparison.metrics.scrapPercent;
    lines.push(ar
      ? `بلغ معدل الهدر في المهمة \u2068${comparison.reference}\u2069 على الآلة نفسها ${n(comparison.metrics.scrapPercent)}٪. الفرق ${delta > 0 ? "+" : ""}${n(delta)} نقطة مئوية.`
      : `${comparison.reference} on the same machine recorded ${n(comparison.metrics.scrapPercent)}% scrap; the difference is ${delta > 0 ? "+" : ""}${n(delta)} percentage points.`);
  }
  lines.push(historical.sufficient
    ? (ar ? `خط الأساس من ${n(historical.count)} مهام متطابقة: ${n(historical.scrapPercent!)}٪ هدر.` : `The baseline from ${n(historical.count)} matching jobs is ${n(historical.scrapPercent!)}% scrap.`)
    : (ar ? "لا يوجد سجل سابق كافٍ للمقارنة الموثوقة بخط أساس." : "Insufficient comparable history for a reliable baseline."));
  lines.push(...selected.slice(0,2).map(code => prompts[code][index]));
  lines.push(ar ? "هذه إرشادات للتحقيق وليست تشخيصًا. البيانات المسجلة لا تثبت السبب." : "This is investigation guidance, not a diagnosis. The recorded data does not establish a cause.");
  return lines.join("\n\n");
}
