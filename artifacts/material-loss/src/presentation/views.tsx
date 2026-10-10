import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GitCompare, Lock, Unlock, MessageSquareWarning, Pencil, ArrowLeft, ShieldCheck, Plus } from "lucide-react";
import { aggregate, baseline, calculate, closureError, previousJobs } from "@workspace/material-accounting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel, Stat, StatusBadge, OutcomeBar, PageHeader } from "@/components/bits";
import { useFmt, useReasonLabel, missingForClose, useFieldList } from "@/lib/format-shared";
import { cn } from "@/lib/utils";
import { WORKER, type PresentationJob } from "./store";

export function useErrText() {
  const { t } = useTranslation();
  const tp = useTranslation("presentation").t;
  return (e: unknown) => {
    const code = e instanceof Error ? e.message : "SERVER_ERROR";
    return t(`errors.${code}`, { defaultValue: tp("failed", { code }) });
  };
}

const day = (s: string) => s.slice(0, 10);

export function JobTable({ jobs, onOpen }: { jobs: PresentationJob[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const tp = useTranslation("presentation").t;
  const f = useFmt();
  if (!jobs.length) return <p className="text-sm text-muted-foreground" data-testid="text-no-jobs">{tp("noJobs")}</p>;
  return <div className="overflow-x-auto rounded-md border border-border">
    <table className="w-full min-w-[560px] text-sm">
      <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
        <th className="px-2 py-1.5 text-start font-medium">{t("jobs.reference")}</th>
        <th className="px-2 py-1.5 text-start font-medium">{t("jobs.product")}</th>
        <th className="px-2 py-1.5 text-start font-medium">{t("outcome.issued")}</th>
        <th className="px-2 py-1.5 text-start font-medium">{t("metrics.scrapRate")}</th>
        <th className="px-2 py-1.5 text-start font-medium" /><th className="px-2 py-1.5" />
      </tr></thead>
      <tbody className="tnum">{jobs.map(j => {
        const m = calculate(j, j.tolerance);
        return <tr key={j.id} className="border-t border-border" data-testid={`row-job-${j.id}`}>
          <th scope="row" className="px-2 py-1.5 text-start font-mono font-medium">{j.reference}</th>
          <td className="px-2 py-1.5">{j.product || t("common.emptyValue")}</td>
          <td className="px-2 py-1.5 font-mono">{f.kg(j.issued)}</td>
          <td className="px-2 py-1.5 font-mono">{f.pct(m.scrapPercent)}</td>
          <td className="px-2 py-1.5"><StatusBadge status={j.status} /></td>
          <td className="px-2 py-1.5 text-end"><Button size="sm" variant="outline" onClick={() => onOpen(j.id)} data-testid={`button-open-${j.id}`}>{tp("open")}</Button></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

export function ManagerDashboard({ jobs, onOpen, onNew, blocked }: { jobs: PresentationJob[]; onOpen: (id: string) => void; onNew: () => void; blocked: boolean }) {
  const { t } = useTranslation();
  const tp = useTranslation("presentation").t;
  const f = useFmt();
  const reasonLabel = useReasonLabel();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const inRange = jobs.filter(j => { const d = day(j.closedAt ?? j.createdAt); return (!from || d >= from) && (!to || d <= to); });
  const d = aggregate(inRange);
  return <div className="space-y-4">
    <PageHeader title={tp("dashboard")} actions={<Button className="h-11 lg:h-9" disabled={blocked} onClick={onNew} data-testid="button-new-job"><Plus className="h-4 w-4" aria-hidden />{tp("newJob")}</Button>} />
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label={t("dashboard.period")}>
      <div><Label htmlFor="p-from" className="text-xs">{t("common.from")}</Label><Input id="p-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1 h-11 w-40 lg:h-9" data-testid="input-from" /></div>
      <div><Label htmlFor="p-to" className="text-xs">{t("common.to")}</Label><Input id="p-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1 h-11 w-40 lg:h-9" data-testid="input-to" /></div>
      {(from || to) && <Button variant="ghost" className="h-11 lg:h-9" onClick={() => { setFrom(""); setTo(""); }} data-testid="button-clear-period">{t("common.clear")}</Button>}
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
      <Stat testId="stat-total" label={t("metrics.totalJobs")} value={f.num(d.totalJobs)} sub={t("metrics.drafts", { count: d.draftCount, value: f.num(d.draftCount) })} />
      <Stat testId="stat-issued" label={t("metrics.issued")} value={f.kg(d.issued)} />
      <Stat testId="stat-good" tone="good" label={t("metrics.good")} value={f.kg(d.good)} />
      <Stat testId="stat-scrap" tone="scrap" label={t("metrics.scrap")} value={f.kg(d.scrap)} />
      <Stat testId="stat-reusable" tone="reusable" label={t("metrics.reusable")} value={f.kg(d.reusable)} sub={`${t("outcome.rework")} ${f.kg(d.rework)}`} />
      <Stat testId="stat-yield" tone="good" label={t("metrics.weightedYield")} value={f.pct(d.yieldPercent)} />
      <Stat testId="stat-scrap-rate" tone="scrap" label={t("metrics.weightedScrap")} value={f.pct(d.scrapPercent)} />
    </div>
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{tp("closedOnly")}</p>
    <Panel title={t("dashboard.reasons")} desc={t("dashboard.reasonsDesc")} testId="panel-reasons">
      {d.scrapReasons.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboard.noReasons")}</p> :
        <table className="w-full text-sm"><thead className="text-xs text-muted-foreground"><tr>
          <th className="py-1 text-start font-medium">{t("form.reason")}</th><th className="py-1 text-end font-medium">{t("form.weight")}</th><th className="py-1 text-end font-medium">%</th>
        </tr></thead><tbody className="tnum">{d.scrapReasons.map(r => <tr key={r.reason} className="border-t border-border">
          <th scope="row" className="py-1.5 text-start font-normal">{reasonLabel(r.reason)}</th>
          <td className="py-1.5 text-end font-mono">{f.kg(r.weight)}</td><td className="py-1.5 text-end font-mono">{f.pct(r.contribution)}</td>
        </tr>)}</tbody></table>}
    </Panel>
    <Panel title={tp("jobs")}><JobTable jobs={inRange} onOpen={onOpen} /></Panel>
  </div>;
}

type DetailProps = {
  job: PresentationJob; all: PresentationJob[]; worker: boolean; blocked: boolean;
  onBack: () => void; onEdit: () => void;
  onClose: () => void; onReopen: (reason: string) => void; onNote: (text: string) => void;
};

export function JobDetailView({ job, all, worker, blocked, onBack, onEdit, onClose, onReopen, onNote }: DetailProps) {
  const { t } = useTranslation();
  const tp = useTranslation("presentation").t;
  const f = useFmt();
  const reasonLabel = useReasonLabel();
  const m = calculate(job, job.tolerance);
  return <div>
    <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back">
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />{tp("back")}
    </button>
    <PageHeader
      title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono" data-testid="text-reference">{job.reference}</span><StatusBadge status={job.status} /></span>}
      subtitle={<span className="flex flex-wrap gap-x-3"><span>{t("detail.created", { date: f.dateTime(job.createdAt) })}</span>{job.closedAt && <span>{t("detail.closedOn", { date: f.dateTime(job.closedAt) })}</span>}</span>}
      actions={<Actions job={job} worker={worker} blocked={blocked} onEdit={onEdit} onClose={onClose} onReopen={onReopen} />}
    />
    <dl className="mb-4 grid grid-cols-1 gap-2 rounded-md border border-card-border bg-card p-3 text-sm sm:grid-cols-3">
      {(["product", "material", "machine"] as const).map(k => <div key={k} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{t(`jobs.${k}`)}</dt><dd className="truncate font-medium">{job[k] || t("common.emptyValue")}</dd>
      </div>)}
    </dl>
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat tone="good" label={t("metrics.yield")} value={f.pct(m.yieldPercent)} sub={f.kg(job.good)} />
          <Stat tone="scrap" label={t("metrics.scrapRate")} value={f.pct(m.scrapPercent)} sub={f.kg(m.scrap)} />
          <Stat tone="reusable" label={t("metrics.reusableRate")} value={f.pct(m.reusablePercent)} sub={f.kg(job.reusable)} />
          <Stat tone="rework" label={t("metrics.reworkRate")} value={f.pct(m.reworkPercent)} sub={f.kg(job.rework)} />
        </div>
        <Panel title={t("detail.breakdown")} desc={t("balance.equation")}>
          <OutcomeBar issued={job.issued} parts={[{ key: "good", value: job.good }, { key: "reusable", value: job.reusable }, { key: "rework", value: job.rework }, { key: "scrap", value: m.scrap }]} />
          <div className="tnum mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 font-mono text-sm">
            <span><span className="font-sans text-muted-foreground">{t("outcome.issued")}: </span>{f.kg(job.issued)}</span>
            <span><span className="font-sans text-muted-foreground">{t("outcome.accounted")}: </span>{f.kg(m.accounted)}</span>
            <span className={cn(!m.balanced && "font-semibold text-scrap")} data-testid="text-residual"><span className="font-sans text-muted-foreground">{t("outcome.residual")}: </span>{f.signedKg(m.residual)}</span>
          </div>
          {job.scrapEntries.length > 0 && <ul className="mt-3 space-y-1 text-sm">{job.scrapEntries.map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{reasonLabel(e.reason)}</span><span className="tnum font-mono text-xs">{f.kg(e.weight)}</span></li>)}</ul>}
        </Panel>
        {!worker && <Comparison job={job} all={all} />}
      </div>
      <div className="min-w-0 space-y-4">
        {worker && <Panel title={t("roles.assignment")}><p className="text-sm">{job.assignedTo === WORKER ? tp("assigned") : tp("ownJob")}</p></Panel>}
        <Panel title={t("detail.notesOperator")}>{job.notes ? <p className="whitespace-pre-wrap text-sm">{job.notes}</p> : <p className="text-sm text-muted-foreground">{t("detail.noNotes")}</p>}</Panel>
        {!worker && <Notes job={job} blocked={blocked} onNote={onNote} />}
      </div>
    </div>
  </div>;
}

function Actions({ job, worker, blocked, onEdit, onClose, onReopen }: { job: PresentationJob; worker: boolean; blocked: boolean; onEdit: () => void; onClose: () => void; onReopen: (r: string) => void }) {
  const { t } = useTranslation();
  const listFields = useFieldList();
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const edit = job.status === "draft" && <Button variant="outline" className="h-11 lg:h-9" disabled={blocked} onClick={onEdit} data-testid="button-edit"><Pencil className="h-4 w-4" aria-hidden />{t("common.edit")}</Button>;
  if (worker) return <>{edit}</>;
  if (job.status === "draft") {
    const missing = missingForClose(job);
    const canClose = !closureError(job, job.tolerance);
    return <>
      {edit}
      <Button className="h-11 lg:h-9" disabled={blocked} onClick={() => setCloseOpen(true)} data-testid="button-close-job"><Lock className="h-4 w-4" aria-hidden />{t("detail.close")}</Button>
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}><DialogContent>
        <DialogHeader><DialogTitle>{t("detail.closeConfirm")}</DialogTitle><DialogDescription>{t("detail.closeDesc")}</DialogDescription></DialogHeader>
        {!canClose && <div className="space-y-1 rounded-sm bg-scrap/10 px-2 py-1.5 text-sm text-scrap"><p>{t("form.closeBlocked")}</p>{missing.length > 0 && <p>{t("form.closeMissing", { fields: listFields(missing) })}</p>}</div>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setCloseOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={!canClose || blocked} onClick={() => { setCloseOpen(false); onClose(); }} data-testid="button-confirm-close">{t("detail.close")}</Button>
        </DialogFooter>
      </DialogContent></Dialog>
    </>;
  }
  return <>
    <Button variant="outline" className="h-11 lg:h-9" disabled={blocked} onClick={() => { setReason(""); setReopenOpen(true); }} data-testid="button-reopen"><Unlock className="h-4 w-4" aria-hidden />{t("detail.reopen")}</Button>
    <Dialog open={reopenOpen} onOpenChange={setReopenOpen}><DialogContent>
      <DialogHeader><DialogTitle>{t("detail.reopenTitle")}</DialogTitle><DialogDescription>{t("detail.reopenDesc")}</DialogDescription></DialogHeader>
      <Label htmlFor="reopen-reason" className="text-xs">{t("detail.reopenReason")} <span className="text-scrap">*</span></Label>
      <Textarea id="reopen-reason" value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} data-testid="input-reopen-reason" />
      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={() => setReopenOpen(false)}>{t("common.cancel")}</Button>
        <Button disabled={!reason.trim() || blocked} onClick={() => { setReopenOpen(false); onReopen(reason.trim()); }} data-testid="button-confirm-reopen">{t("detail.reopen")}</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </>;
}

function Comparison({ job, all }: { job: PresentationJob; all: PresentationJob[] }) {
  const { t } = useTranslation();
  const f = useFmt();
  const reasonLabel = useReasonLabel();
  const candidates = previousJobs(job, all);
  const [selId, setSelId] = useState("");
  const sel = candidates.find(c => c.id === selId) ?? candidates[0] ?? null;
  const base = baseline(job, all);
  const mj = calculate(job, job.tolerance);
  const ms = sel ? calculate(sel, sel.tolerance) : null;
  const diff = ms ? mj.scrapPercent - ms.scrapPercent : null;
  return <Panel testId="panel-comparison" title={<span className="flex items-center gap-1.5"><GitCompare className="h-4 w-4 text-primary" aria-hidden />{t("detail.comparison")}</span>} desc={t("detail.comparisonDesc")}>
    <div className="space-y-4">
      {!sel || !ms ? <p className="text-sm text-muted-foreground">{t("detail.noCandidates")}</p> : <>
        <div>
          <Label htmlFor="cmp" className="text-xs">{t("detail.compareWith")}</Label>
          <select id="cmp" value={sel.id} onChange={e => setSelId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-card px-2 text-sm lg:h-9" data-testid="select-comparison">
            {candidates.map(c => <option key={c.id} value={c.id}>{c.reference} · {c.product || t("common.emptyValue")} · {f.date(c.closedAt ?? c.createdAt)}</option>)}
          </select>
        </div>
        <div className="overflow-hidden rounded-md border border-border"><table className="w-full table-fixed text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="w-1/3 px-2 py-1.5" /><th className="px-2 py-1.5 text-start font-medium">{t("detail.thisJob")}</th><th className="px-2 py-1.5 text-start font-medium">{t("detail.previousJob")}</th></tr></thead>
          <tbody className="tnum">{[
            [t("jobs.reference"), job.reference, sel.reference],
            [t("jobs.product"), job.product, sel.product],
            [t("jobs.material"), job.material, sel.material],
            [t("outcome.issued"), f.kg(job.issued), f.kg(sel.issued)],
            [t("metrics.scrapRate"), f.pct(mj.scrapPercent), f.pct(ms.scrapPercent)],
            [t("metrics.yield"), f.pct(mj.yieldPercent), f.pct(ms.yieldPercent)],
            [t("metrics.largest"), mj.largestReason && reasonLabel(mj.largestReason), ms.largestReason && reasonLabel(ms.largestReason)],
          ].map(([k, a, b]) => <tr key={k} className="border-t border-border">
            <th scope="row" className="px-2 py-1.5 text-start text-xs font-normal text-muted-foreground [overflow-wrap:anywhere]">{k}</th>
            <td className="px-2 py-1.5 [overflow-wrap:anywhere]">{a || "\u2014"}</td><td className="px-2 py-1.5 [overflow-wrap:anywhere]">{b || "\u2014"}</td>
          </tr>)}</tbody>
        </table></div>
        {diff !== null && <p className={cn("text-sm font-medium", diff > 0 ? "text-scrap" : diff < 0 ? "text-good" : "")} data-testid="text-difference">
          {t("detail.difference")}: {diff > 0 ? t("detail.diffHigher", { value: f.pp(diff) }) : diff < 0 ? t("detail.diffLower", { value: f.pp(diff) }) : t("detail.diffSame")}
        </p>}
        <p className="text-xs text-muted-foreground">{t("detail.contextNote")}</p>
      </>}
      <div className="border-t border-border pt-3" data-testid="section-baseline">
        <h3 className="text-xs font-semibold">{t("detail.baseline")}</h3>
        <p className="text-xs text-muted-foreground">{t("detail.baselineDesc", { days: f.num(base.days) })}</p>
        {base.sufficient && base.scrapPercent !== null ? <div className="mt-2 space-y-1 text-sm">
          <p>{t("detail.baselineValue", { value: f.pct(base.scrapPercent), n: f.num(base.count) })}</p>
          {base.difference !== null && <p className={cn("font-medium", base.difference > 0 ? "text-scrap" : "text-good")}>{t("detail.baselineDiff", { value: f.pp(base.difference), dir: base.difference >= 0 ? t("detail.above") : t("detail.below") })}</p>}
        </div> : <p className="mt-2 rounded-sm bg-muted px-2 py-1.5 text-sm text-muted-foreground">{t("detail.baselineInsufficient", { n: f.num(base.count) })}</p>}
      </div>
    </div>
  </Panel>;
}

function Notes({ job, blocked, onNote }: { job: PresentationJob; blocked: boolean; onNote: (text: string) => void }) {
  const { t } = useTranslation();
  const tp = useTranslation("presentation").t;
  const f = useFmt();
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);
  const notes = [...job.investigationNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <Panel testId="panel-investigation" title={<span className="flex items-center gap-1.5"><MessageSquareWarning className="h-4 w-4 text-rework-ink" aria-hidden />{t("detail.investigation")}</span>} desc={`${t("detail.unverifiedDesc")} ${tp("notesHint")}`}>
    <form onSubmit={e => { e.preventDefault(); if (!text.trim()) { setErr(true); return; } setErr(false); onNote(text.trim()); setText(""); }}>
      <Label htmlFor="note" className="sr-only">{t("detail.addNote")}</Label>
      <Textarea id="note" value={text} maxLength={4000} onChange={e => setText(e.target.value)} placeholder={t("detail.notePh")} data-testid="input-note" />
      {err && <p role="alert" className="mt-1 text-xs text-scrap">{t("errors.NOTE_REQUIRED")}</p>}
      <Button type="submit" variant="outline" className="mt-2 h-11 w-full lg:h-9" disabled={blocked} data-testid="button-add-note">{t("detail.addNote")}</Button>
    </form>
    {notes.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("detail.noInvestigation")}</p> :
      <ul className="mt-3 space-y-2">{notes.map(n => <li key={n.id} className="rounded-sm border border-dashed border-rework/50 bg-rework/5 p-2.5" data-testid={`note-${n.id}`}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[11px]"><span className="font-semibold uppercase tracking-wide text-rework-ink">{t("detail.unverified")}</span><span className="text-muted-foreground">{f.dateTime(n.createdAt)}</span></div>
        <p className="whitespace-pre-wrap text-sm">{n.text}</p>
      </li>)}</ul>}
  </Panel>;
}
