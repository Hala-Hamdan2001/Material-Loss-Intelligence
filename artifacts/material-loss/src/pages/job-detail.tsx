import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useTranslation } from 'react-i18next';
import { UserCheck, Pencil, Lock, Unlock, Sparkles, MessageSquareWarning, GitCompare, FileQuestion, Equal, EqualNot } from 'lucide-react';
import {
  useGetJob, useGetComparison, useCloseJob, useReopenJob, useAddInvestigationNote, useGenerateInsight, useGetWorkspace, useListMembers, useAssignJob,
  getGetJobQueryKey, getListMembersQueryKey, getGetComparisonQueryKey, type Job, type Insight,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, Panel, Stat, StatusBadge, SignalBadge, OutcomeBar, ErrorState, EmptyState, LoadingBlock, DemoTag } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errorCode, missingForClose, useErrorText, useFieldList, useFmt, useInvalidateBusiness, useReasonLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBackTarget } from '@/hooks/use-nav';
import { BackLink } from '@/components/back-link';
import { withBack } from '@/lib/nav';

export default function JobDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const errText = useErrorText();
  const back = useBackTarget();
  const q = useGetJob(id, { query: { enabled: !!id, queryKey: getGetJobQueryKey(id), staleTime: 15_000 } });

  if (q.isLoading) return <LoadingBlock rows={10} />;
  if (q.isError || !q.data) {
    return errorCode(q.error) === 'NOT_FOUND' ? (
      <EmptyState icon={<FileQuestion className="h-5 w-5" aria-hidden />} title={t('detail.notFound')} desc={t('detail.notFoundDesc')} action={<Button asChild variant="outline"><Link href={back ?? '/jobs'}>{t('detail.back')}</Link></Button>} />
    ) : (
      <ErrorState message={`${t('detail.error')} ${errText(q.error)}`} onRetry={() => void q.refetch()} />
    );
  }
  return <Detail job={q.data} />;
}

function Detail({ job }: { job: Job }) {
  const { t } = useTranslation();
  const f = useFmt();
  const reasonLabel = useReasonLabel();
  const ws = useGetWorkspace();
  const role = ws.data?.role;
  const worker = role !== 'demo' && role !== 'manager';
  const m = job.metrics;
  const [comparisonId, setComparisonId] = useState<string | undefined>(undefined);

  const scrapByReason = job.scrapEntries.reduce<Record<string, number>>((acc, e) => {
    acc[e.reason] = (acc[e.reason] ?? 0) + e.weight;
    return acc;
  }, {});
  const reasons = Object.entries(scrapByReason).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <BackLink />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono" data-testid="text-reference">{job.reference}</span>
            <StatusBadge status={job.status} />
            {job.isDemo && <DemoTag />}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{t('detail.created', { date: f.dateTime(job.createdAt) })}</span>
            {job.closedAt && <span>{t('detail.closedOn', { date: f.dateTime(job.closedAt) })}</span>}
            <span>{t('detail.revision', { n: f.num(job.revision) })}</span>
          </span>
        }
        actions={<JobActions job={job} worker={worker} />}
      />

      <dl className="mb-4 grid grid-cols-1 gap-2 rounded-md border border-card-border bg-card p-3 text-sm sm:grid-cols-3">
        {(['product', 'material', 'machine'] as const).map((k) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{t(`jobs.${k}`)}</dt>
            <dd className="truncate font-medium" data-testid={`text-${k}`}>{job[k] || <span className="text-muted-foreground">{t('common.emptyValue')}</span>}</dd>
          </div>
        ))}
      </dl>

      {job.signals.length > 0 && (
        <ul className="mb-4 grid gap-2 sm:grid-cols-3">
          {job.signals.map((s) => (
            <li key={s} className="rounded-md border border-card-border bg-card p-3">
              <SignalBadge signal={s} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t(`signals.${s}_desc`, { value: f.pct(ws.data?.highScrapThreshold ?? 0) })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat testId="stat-yield" tone="good" label={t('metrics.yield')} value={f.pct(m.yieldPercent)} sub={f.kg(job.good)} />
            <Stat testId="stat-scrap" tone="scrap" label={t('metrics.scrapRate')} value={f.pct(m.scrapPercent)} sub={f.kg(m.scrap)} />
            <Stat testId="stat-reusable" tone="reusable" label={t('metrics.reusableRate')} value={f.pct(m.reusablePercent)} sub={f.kg(job.reusable)} />
            <Stat testId="stat-rework" tone="rework" label={t('metrics.reworkRate')} value={f.pct(m.reworkPercent)} sub={f.kg(job.rework)} />
          </div>

          <Panel title={t('detail.breakdown')} desc={t('balance.equation')} testId="panel-breakdown">
            <OutcomeBar
              issued={job.issued}
              parts={[
                { key: 'good', value: job.good },
                { key: 'reusable', value: job.reusable },
                { key: 'rework', value: job.rework },
                { key: 'scrap', value: m.scrap },
              ]}
            />
            <div className="tnum mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 font-mono text-sm">
              <span><span className="font-sans text-muted-foreground">{t('outcome.issued')}: </span>{f.kg(job.issued)}</span>
              <span><span className="font-sans text-muted-foreground">{t('outcome.accounted')}: </span>{f.kg(m.accounted)}</span>
              <span className={cn(!m.balanced && 'text-scrap font-semibold')} data-testid="text-residual">
                <span className="font-sans text-muted-foreground">{t('outcome.residual')}: </span>{f.signedKg(m.residual)}
              </span>
              <span className={cn('font-sans text-xs', m.balanced ? 'text-good' : 'text-scrap')}>
                {m.balanced ? t('balance.balanced') : t('balance.unbalanced')} · {t('balance.tolerance', { value: f.kg(job.tolerance) })}
              </span>
            </div>
          </Panel>

          <Panel title={t('detail.scrapReasons')} testId="panel-scrap-reasons">
            {reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('detail.noScrap')}</p>
            ) : (
              <>
                {m.largestReason && (
                  <div className="mb-3 rounded-sm border-s-2 border-scrap bg-scrap/5 px-3 py-2" data-testid="text-largest-reason">
                    <div className="text-xs text-muted-foreground">{t('metrics.largest')}</div>
                    <div className="font-medium">{reasonLabel(m.largestReason)}</div>
                    <div className="tnum font-mono text-xs">{t('detail.largestWeight', { weight: f.kg(m.largestWeight), share: f.pct(m.largestContribution) })}</div>
                  </div>
                )}
                <ol className="space-y-2">
                  {reasons.map(([r, w]) => (
                    <li key={r}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{reasonLabel(r)}</span>
                        <span className="tnum shrink-0 font-mono text-xs">
                          {f.kg(w)} <span className="text-muted-foreground">{f.pct(m.scrap > 0 ? (w / m.scrap) * 100 : 0)}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-sm bg-muted" aria-hidden>
                        <div className="h-2 rounded-sm bg-scrap" style={{ width: `${reasons[0][1] > 0 ? (w / reasons[0][1]) * 100 : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </Panel>

          {!worker && <ComparisonPanel job={job} comparisonId={comparisonId} onSelect={setComparisonId} />}
        </div>

        <div className="min-w-0 space-y-4">
          {role === 'manager' && <AssignmentPanel job={job} me={ws.data?.userId ?? null} />}
          {worker && (job.createdBy || job.assignedTo) && (
            <Panel title={t('roles.assignment')}>
              <dl className="space-y-1 text-sm">
                <div><dt className="text-xs text-muted-foreground">{t('roles.createdBy')}</dt><dd dir="ltr" className="break-all font-mono text-xs" data-testid="text-created-by">{job.createdBy ?? t('common.emptyValue')}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t('roles.assignedTo')}</dt><dd dir="ltr" className="break-all font-mono text-xs" data-testid="text-assigned-to">{job.assignedTo ?? t('roles.unassigned')}</dd></div>
              </dl>
            </Panel>
          )}
          {!worker && <InsightPanel job={job} comparisonId={comparisonId} />}
          <Panel title={t('detail.notesOperator')}>
            {job.notes ? <p className="whitespace-pre-wrap text-sm" data-testid="text-notes">{job.notes}</p> : <p className="text-sm text-muted-foreground">{t('detail.noNotes')}</p>}
          </Panel>
          {!worker && <NotesPanel job={job} />}
        </div>
      </div>
    </div>
  );
}

function AssignmentPanel({ job, me }: { job: Job; me: string | null }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const invalidate = useInvalidateBusiness();
  const members = useListMembers({ query: { queryKey: getListMembersQueryKey(), staleTime: 15_000 } });
  const assign = useAssignJob();
  const [value, setValue] = useState(job.assignedTo ?? '');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setValue(job.assignedTo ?? ''); }, [job.assignedTo]);
  const active = (members.data ?? []).filter((mb) => mb.active);
  const showCurrent = job.assignedTo && !active.some((mb) => mb.userId === job.assignedTo);
  return (
    <Panel testId="panel-assignment" title={<span className="flex items-center gap-1.5"><UserCheck className="h-4 w-4 text-primary" aria-hidden />{t('roles.assignment')}</span>}>
      <p className="mb-2 text-xs text-muted-foreground">
        {t('roles.createdBy')}: <span dir="ltr" className="break-all font-mono" data-testid="text-created-by">{job.createdBy ?? t('common.emptyValue')}</span>
      </p>
      <Label htmlFor="assignee" className="text-xs">{t('roles.assignedTo')}</Label>
      <select
        id="assignee"
        value={value}
        disabled={members.isLoading}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1 h-11 w-full rounded-md border border-input bg-card px-2 font-mono text-sm lg:h-9"
        data-testid="select-assignee"
      >
        <option value="">{t('roles.unassigned')}</option>
        {showCurrent && <option value={job.assignedTo ?? ''}>{job.assignedTo}</option>}
        {active.map((mb) => (
          <option key={mb.userId} value={mb.userId}>
            {mb.userId}{mb.userId === me ? ` (${t('roles.you')})` : ''} · {t(`roles.${mb.role}`)}
          </option>
        ))}
      </select>
      {members.isError && <p className="mt-1 text-xs text-scrap">{t('roles.membersError')}</p>}
      {err && <p role="alert" className="mt-2 rounded-sm bg-scrap/10 px-2 py-1.5 text-xs text-scrap">{t(err)}</p>}
      <Button
        variant="outline"
        className="mt-2 h-11 w-full lg:h-9"
        disabled={assign.isPending || value === (job.assignedTo ?? '')}
        data-testid="button-assign"
        onClick={() => {
          setErr(null);
          assign.mutate(
            { id: job.id, data: { assignedTo: value || null, revision: job.revision } },
            {
              onSuccess: () => { void invalidate(); toast({ title: t('roles.assigned') }); },
              onError: (e) => { setErr(`errors.${errorCode(e)}`); void invalidate(); },
            },
          );
        }}
      >
        {assign.isPending ? t('form.saving') : t('roles.assign')}
      </Button>
    </Panel>
  );
}

function JobActions({ job, worker }: { job: Job; worker: boolean }) {
  const back = useBackTarget();
  const { t } = useTranslation();
  const { toast } = useToast();
  const errText = useErrorText();
  const invalidate = useInvalidateBusiness();
  const [closeOpen, setCloseOpen] = useState(false);
  const listFields = useFieldList();
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const close = useCloseJob();
  const reopen = useReopenJob();

  if (worker) {
    return job.status === 'draft' ? (
      <Button asChild variant="outline" className="h-11 lg:h-9">
        <Link href={withBack(`/jobs/${job.id}/edit`, back)} data-testid="button-edit">
          <Pencil className="h-4 w-4" aria-hidden />
          {t('common.edit')}
        </Link>
      </Button>
    ) : null;
  }

  if (job.status === 'draft') {
    const missing = missingForClose(job);
    const canClose = job.metrics.balanced && job.issued > 0 && missing.length === 0;
    return (
      <>
        <Button asChild variant="outline" className="h-11 lg:h-9">
          <Link href={withBack(`/jobs/${job.id}/edit`, back)} data-testid="button-edit">
            <Pencil className="h-4 w-4" aria-hidden />
            {t('common.edit')}
          </Link>
        </Button>
        <Button className="h-11 lg:h-9" onClick={() => { setErr(null); setCloseOpen(true); }} data-testid="button-close-job" title={canClose ? undefined : t('form.closeBlocked')}>
          <Lock className="h-4 w-4" aria-hidden />
          {t('detail.close')}
        </Button>
        <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('detail.closeConfirm')}</DialogTitle>
              <DialogDescription>{t('detail.closeDesc')}</DialogDescription>
            </DialogHeader>
            {!canClose && (
              <div className="space-y-1 rounded-sm bg-scrap/10 px-2 py-1.5 text-sm text-scrap">
                <p>{t('form.closeBlocked')}</p>
                {missing.length > 0 && <p>{t('form.closeMissing', { fields: listFields(missing) })}</p>}
              </div>
            )}
            {err && <p role="alert" className="rounded-sm bg-scrap/10 px-2 py-1.5 text-sm text-scrap">{t(err)}</p>}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setCloseOpen(false)}>{t('common.cancel')}</Button>
              <Button
                disabled={close.isPending || !canClose}
                data-testid="button-confirm-close"
                onClick={() =>
                  close.mutate(
                    { id: job.id, data: { revision: job.revision } },
                    {
                      onSuccess: () => { void invalidate(); setCloseOpen(false); toast({ title: t('form.closed') }); },
                      onError: (e) => { setErr(`errors.${errorCode(e)}`); if (errorCode(e) === 'STALE_REVISION') void invalidate(); },
                    },
                  )
                }
              >
                {close.isPending ? t('form.saving') : t('detail.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button variant="outline" className="h-11 lg:h-9" onClick={() => { setErr(null); setReason(''); setReopenOpen(true); }} data-testid="button-reopen">
        <Unlock className="h-4 w-4" aria-hidden />
        {t('detail.reopen')}
      </Button>
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.reopenTitle')}</DialogTitle>
            <DialogDescription>{t('detail.reopenDesc')}</DialogDescription>
          </DialogHeader>
          <Label htmlFor="reopen-reason" className="text-xs">{t('detail.reopenReason')} <span className="text-scrap">*</span></Label>
          <Textarea id="reopen-reason" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} data-testid="input-reopen-reason" />
          {err && <p role="alert" className="rounded-sm bg-scrap/10 px-2 py-1.5 text-sm text-scrap">{t(err)}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReopenOpen(false)}>{t('common.cancel')}</Button>
            <Button
              disabled={reopen.isPending || !reason.trim()}
              data-testid="button-confirm-reopen"
              onClick={() =>
                reopen.mutate(
                  { id: job.id, data: { revision: job.revision, reason: reason.trim() } },
                  {
                    onSuccess: () => { void invalidate(); setReopenOpen(false); toast({ title: t('detail.reopened') }); },
                    onError: (e) => { setErr(`errors.${errorCode(e)}`); if (errorCode(e) === 'STALE_REVISION') void invalidate(); },
                  },
                )
              }
            >
              {reopen.isPending ? t('form.saving') : t('detail.reopen')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ComparisonPanel({ job, comparisonId, onSelect }: { job: Job; comparisonId?: string; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const f = useFmt();
  const errText = useErrorText();
  const params = comparisonId ? { comparisonId } : undefined;
  const q = useGetComparison(job.id, params, { query: { queryKey: getGetComparisonQueryKey(job.id, params), staleTime: 15_000 } });
  const c = q.data;
  const sel = c?.selected ?? null;

  return (
    <Panel
      testId="panel-comparison"
      title={<span className="flex items-center gap-1.5"><GitCompare className="h-4 w-4 text-primary" aria-hidden />{t('detail.comparison')}</span>}
      desc={t('detail.comparisonDesc')}
    >
      {q.isLoading ? (
        <LoadingBlock rows={3} />
      ) : q.isError || !c ? (
        <ErrorState message={`${t('detail.compError')} ${errText(q.error)}`} onRetry={() => void q.refetch()} />
      ) : (
        <div className="space-y-4">
          {c.candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('detail.noCandidates')}</p>
          ) : (
            <>
              <div>
                <Label htmlFor="cmp" className="text-xs">{t('detail.compareWith')}</Label>
                <select
                  id="cmp"
                  value={sel?.id ?? ''}
                  onChange={(e) => onSelect(e.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-input bg-card px-2 text-sm lg:h-9"
                  data-testid="select-comparison"
                >
                  {!sel && <option value="">{t('reasons.choose')}</option>}
                  {c.candidates.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.reference} · {cand.product || t('common.emptyValue')} · {f.date(cand.closedAt ?? cand.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
              {sel && (
                <>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full table-fixed text-sm">
                      <thead className="bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th className="w-1/3 px-2 py-1.5 text-start font-medium" />
                          <th className="px-2 py-1.5 text-start font-medium">{t('detail.thisJob')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{t('detail.previousJob')}</th>
                        </tr>
                      </thead>
                      <tbody className="tnum">
                        {[
                          [t('jobs.reference'), job.reference, sel.reference],
                          [t('jobs.product'), job.product, sel.product],
                          [t('jobs.material'), job.material, sel.material],
                          [t('outcome.issued'), f.kg(job.issued), f.kg(sel.issued)],
                          [t('metrics.scrapRate'), f.pct(job.metrics.scrapPercent), f.pct(sel.metrics.scrapPercent)],
                          [t('metrics.yield'), f.pct(job.metrics.yieldPercent), f.pct(sel.metrics.yieldPercent)],
                          [t('metrics.largest'), job.metrics.largestReason ? reasonOr(job.metrics.largestReason) : '', sel.metrics.largestReason ? reasonOr(sel.metrics.largestReason) : ''],
                        ].map(([k, a, b]) => (
                          <tr key={k} className="border-t border-border">
                            <th scope="row" className="px-2 py-1.5 align-top text-start text-xs font-normal text-muted-foreground [overflow-wrap:anywhere]">{k}</th>
                            <td className="px-2 py-1.5 align-top [overflow-wrap:anywhere]">{a || '\u2014'}</td>
                            <td className="px-2 py-1.5 align-top [overflow-wrap:anywhere]">{b || '\u2014'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {c.difference !== null && (
                    <p className={cn('text-sm font-medium', c.difference > 0 ? 'text-scrap' : c.difference < 0 ? 'text-good' : '')} data-testid="text-difference">
                      {t('detail.difference')}:{' '}
                      {c.difference > 0 ? t('detail.diffHigher', { value: f.pp(c.difference) }) : c.difference < 0 ? t('detail.diffLower', { value: f.pp(c.difference) }) : t('detail.diffSame')}
                    </p>
                  )}
                  <div>
                    <h3 className="text-xs font-semibold">{t('detail.contextTitle')}</h3>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {(['product', 'material'] as const).map((k) => {
                        const same = job[k] === sel[k];
                        return (
                          <li key={k} className="flex items-center gap-1.5">
                            {same ? <Equal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : <EqualNot className="h-3.5 w-3.5 text-rework-ink" aria-hidden />}
                            {same ? t('detail.contextSame', { field: t(`jobs.${k}`) }) : t('detail.contextDiff', { field: t(`jobs.${k}`) })}
                          </li>
                        );
                      })}
                      <li className="flex items-center gap-1.5">
                        {job.issued === sel.issued ? <Equal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : <EqualNot className="h-3.5 w-3.5 text-rework-ink" aria-hidden />}
                        {job.issued === sel.issued ? t('detail.contextSame', { field: t('outcome.issued') }) : t('detail.issuedDiff', { value: f.kg(Math.abs(job.issued - sel.issued)) })}
                      </li>
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">{t('detail.contextNote')}</p>
                  </div>
                </>
              )}
            </>
          )}
          <div className="border-t border-border pt-3" data-testid="section-baseline">
            <h3 className="text-xs font-semibold">{t('detail.baseline')}</h3>
            <p className="text-xs text-muted-foreground">{t('detail.baselineDesc', { days: f.num(c.baseline.days) })}</p>
            {c.baseline.sufficient && c.baseline.scrapPercent !== null ? (
              <div className="mt-2 space-y-1 text-sm">
                <p>{t('detail.baselineValue', { value: f.pct(c.baseline.scrapPercent), n: f.num(c.baseline.count) })}</p>
                {c.baseline.difference !== null && (
                  <p className={cn('font-medium', c.baseline.difference > 0 ? 'text-scrap' : 'text-good')}>
                    {t('detail.baselineDiff', { value: f.pp(c.baseline.difference), dir: c.baseline.difference >= 0 ? t('detail.above') : t('detail.below') })}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 rounded-sm bg-muted px-2 py-1.5 text-sm text-muted-foreground">
                {t('detail.baselineInsufficient', { n: f.num(c.baseline.count) })}
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );

  function reasonOr(r: string) {
    return ['setup_layout', 'damaged', 'unspecified_demo'].includes(r) ? t(`reasons.${r}`) : r;
  }
}

function InsightPanel({ job, comparisonId }: { job: Job; comparisonId?: string }) {
  const { t, i18n } = useTranslation();
  const errText = useErrorText();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const params = comparisonId ? { comparisonId } : undefined;
  const cmp = useGetComparison(job.id, params, { query: { queryKey: getGetComparisonQueryKey(job.id, params), staleTime: 15_000 } });
  const effectiveCmp = cmp.data?.selected?.id ?? '';
  const [result, setResult] = useState<{ insight: Insight; comparisonId: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const gen = useGenerateInsight();

  const current =
    result && result.insight.language === lang && result.insight.revision === job.revision && result.comparisonId === effectiveCmp ? result.insight : null;
  const stale = !!result && !current;

  return (
    <Panel
      testId="panel-insight"
      title={<span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" aria-hidden />{t('detail.insight')}</span>}
      desc={t('detail.insightDesc')}
    >
      {current ? (
        <div className="space-y-2">
          <p className={cn('rounded-sm px-2 py-1 text-[11px] font-medium', current.source === 'ai' ? 'bg-accent text-accent-foreground' : 'bg-rework/12 text-rework-ink')} data-testid="text-insight-source">
            {current.source === 'ai' ? t('detail.sourceAi') : t('detail.sourceFallback')}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed" lang={current.language} data-testid="text-insight">{current.text}</p>
        </div>
      ) : stale ? (
        <p className="text-sm text-muted-foreground">{t('detail.insightStale')}</p>
      ) : null}
      {err && <p role="alert" className="mt-2 rounded-sm bg-scrap/10 px-2 py-1.5 text-xs text-scrap">{t(err)}</p>}
      <Button
        variant={current ? 'outline' : 'default'}
        className="mt-3 h-11 w-full lg:h-9"
        disabled={gen.isPending || cmp.isLoading}
        data-testid="button-generate-insight"
        onClick={() => {
          setErr(null);
          const cid = effectiveCmp;
          gen.mutate(
            { id: job.id, data: { language: lang, comparisonId: cid } },
            { onSuccess: (insight) => setResult({ insight, comparisonId: cid }), onError: (e) => setErr(`errors.${errorCode(e)}`) },
          );
        }}
      >
        {gen.isPending ? t('detail.generating') : current ? t('detail.regenerate') : t('detail.generate')}
      </Button>
    </Panel>
  );
}

function NotesPanel({ job }: { job: Job }) {
  const { t } = useTranslation();
  const f = useFmt();
  const { toast } = useToast();
  const errText = useErrorText();
  const invalidate = useInvalidateBusiness();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const add = useAddInvestigationNote();
  const notes = [...job.investigationNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Panel
      testId="panel-investigation"
      title={<span className="flex items-center gap-1.5"><MessageSquareWarning className="h-4 w-4 text-rework-ink" aria-hidden />{t('detail.investigation')}</span>}
      desc={t('detail.unverifiedDesc')}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          if (!text.trim()) { setErr('errors.NOTE_REQUIRED'); return; }
          add.mutate(
            { id: job.id, data: { text: text.trim() } },
            { onSuccess: () => { setText(''); void invalidate(); toast({ title: t('detail.noteAdded') }); }, onError: (e2) => setErr(`errors.${errorCode(e2)}`) },
          );
        }}
      >
        <Label htmlFor="note" className="sr-only">{t('detail.addNote')}</Label>
        <Textarea id="note" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={t('detail.notePh')} data-testid="input-note" />
        {err && <p role="alert" className="mt-1 text-xs text-scrap">{t(err)}</p>}
        <Button type="submit" variant="outline" className="mt-2 h-11 w-full lg:h-9" disabled={add.isPending} data-testid="button-add-note">
          {add.isPending ? t('form.saving') : t('detail.addNote')}
        </Button>
      </form>
      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('detail.noInvestigation')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-sm border border-dashed border-rework/50 bg-rework/5 p-2.5" data-testid={`note-${n.id}`}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                <span className="font-semibold uppercase tracking-wide text-rework-ink">{t('detail.unverified')}</span>
                <span className="text-muted-foreground">{f.dateTime(n.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
