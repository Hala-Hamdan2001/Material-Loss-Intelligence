import { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Plus, Inbox, ShieldCheck } from 'lucide-react';
import { useGetDashboard, useGetWorkspace } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, Panel, Stat, OutcomeBar, ErrorState, EmptyState, LoadingBlock } from '@/components/bits';
import { JobList } from '@/components/job-list';
import { useFmt, useReasonLabel, useErrorText, cleanParams } from '@/lib/format';

export default function Dashboard() {
  const { t } = useTranslation();
  const f = useFmt();
  const reasonLabel = useReasonLabel();
  const errText = useErrorText();
  const ws = useGetWorkspace();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = cleanParams({ from, to });
  const q = useGetDashboard(params);
  const d = q.data;

  const actions = (
    <Button asChild className="h-11 lg:h-9">
      <Link href="/jobs/new" data-testid="button-new-job">
        <Plus className="h-4 w-4" aria-hidden />
        {t('nav.newJob')}
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} actions={actions} />

      <div className="mb-4 flex flex-wrap items-end gap-3" role="group" aria-label={t('dashboard.period')}>
        <div>
          <Label htmlFor="d-from" className="text-xs">{t('common.from')}</Label>
          <Input id="d-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 w-40 lg:h-9" data-testid="input-from" />
        </div>
        <div>
          <Label htmlFor="d-to" className="text-xs">{t('common.to')}</Label>
          <Input id="d-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1 h-11 w-40 lg:h-9" data-testid="input-to" />
        </div>
        {(from || to) && (
          <Button variant="ghost" className="h-11 lg:h-9" onClick={() => { setFrom(''); setTo(''); }} data-testid="button-clear-period">
            {t('common.clear')}
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[68px]" />)}
          </div>
          <LoadingBlock rows={6} />
        </div>
      ) : q.isError || !d ? (
        <ErrorState message={`${t('dashboard.error')} ${errText(q.error)}`} onRetry={() => void q.refetch()} />
      ) : d.totalJobs === 0 && !params ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" aria-hidden />}
          title={t('dashboard.empty')}
          desc={ws.data?.isDemo ? t('dashboard.emptyDesc') : t('workspace.emptyPrivate')}
          action={actions}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <Stat testId="stat-total" label={t('metrics.totalJobs')} value={f.num(d.totalJobs)} sub={t('metrics.drafts', { count: d.draftCount, value: f.num(d.draftCount) }).replace(String(d.draftCount), f.num(d.draftCount))} />
            <Stat testId="stat-issued" label={t('metrics.issued')} value={f.kg(d.issued)} />
            <Stat testId="stat-good" tone="good" label={t('metrics.good')} value={f.kg(d.good)} />
            <Stat testId="stat-scrap" tone="scrap" label={t('metrics.scrap')} value={f.kg(d.scrap)} />
            <Stat testId="stat-reusable" tone="reusable" label={t('metrics.reusable')} value={f.kg(d.reusable)} sub={`${t('outcome.rework')} ${f.kg(d.rework)}`} />
            <Stat testId="stat-yield" tone="good" label={t('metrics.weightedYield')} value={f.pct(d.yieldPercent)} />
            <Stat testId="stat-scrap-rate" tone="scrap" label={t('metrics.weightedScrap')} value={f.pct(d.scrapPercent)} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t('metrics.closedOnly')}
          </p>

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel className="lg:col-span-3" title={t('dashboard.outcomes')} desc={t('dashboard.outcomesDesc')} testId="panel-outcomes">
              <OutcomeBar
                issued={d.issued}
                parts={[
                  { key: 'good', value: d.good },
                  { key: 'reusable', value: d.reusable },
                  { key: 'rework', value: d.rework },
                  { key: 'scrap', value: d.scrap },
                ]}
              />
            </Panel>
            <Panel className="lg:col-span-2" title={t('dashboard.reasons')} desc={t('dashboard.reasonsDesc')} testId="panel-reasons">
              {d.scrapReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.noReasons')}</p>
              ) : (
                <ol className="space-y-2.5" aria-label={t('dashboard.reasonsChartLabel')}>
                  {d.scrapReasons.map((r, i) => {
                    const max = d.scrapReasons[0].weight || 1;
                    return (
                      <li key={r.reason} data-testid={`reason-${i}`}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">
                            <span className="me-1.5 font-mono text-xs text-muted-foreground">{f.num(i + 1)}</span>
                            {reasonLabel(r.reason)}
                          </span>
                          <span className="tnum shrink-0 font-mono text-xs">
                            {f.kg(r.weight)} <span className="text-muted-foreground">{f.pct(r.contribution)}</span>
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-sm bg-muted" aria-hidden>
                          <div className="h-2 rounded-sm bg-scrap" style={{ width: `${(r.weight / max) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>
          </div>

          <Panel title={t('dashboard.attention')} desc={t('dashboard.attentionDesc')} testId="panel-attention">
            {d.attentionJobs.length === 0 ? <p className="text-sm text-muted-foreground">{t('dashboard.noAttention')}</p> : <JobList jobs={d.attentionJobs} dense />}
          </Panel>

          <Panel
            title={t('dashboard.recent')}
            testId="panel-recent"
            action={
              <Link href="/jobs" className="text-xs font-medium text-primary hover:underline" data-testid="link-all-jobs">
                {t('dashboard.allJobs')}
              </Link>
            }
          >
            {d.recentJobs.length === 0 ? <p className="text-sm text-muted-foreground">{t('dashboard.noRecent')}</p> : <JobList jobs={d.recentJobs} />}
          </Panel>
        </div>
      )}
    </div>
  );
}
