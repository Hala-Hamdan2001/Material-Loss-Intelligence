import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Plus, Inbox, ShieldCheck } from 'lucide-react';
import { useGetDashboard, useGetWorkspace } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, Panel, Stat, OutcomeBar, ErrorState, EmptyState, LoadingBlock } from '@/components/bits';
import { JobList } from '@/components/job-list';
import { LatestClosedScrap, ScrapReasonsDonut } from '@/components/dashboard-charts';
import { DateRangeFields } from '@/components/date-range';
import { withBack } from '@/lib/nav';
import { useUrlParams, useValidRange, useScrollMemory } from '@/hooks/use-nav';
import { useFmt, useErrorText, cleanParams } from '@/lib/format';

const KEYS = ['from', 'to'] as const;

export default function Dashboard() {
  const { t } = useTranslation();
  const f = useFmt();
  const errText = useErrorText();
  const ws = useGetWorkspace();
  const { values, set, here } = useUrlParams(KEYS);
  const { from, to } = values;
  const range = useValidRange(from, to);
  // Only the last valid period is ever requested: no 400s while a range is half-typed.
  const params = cleanParams(range.active);
  const q = useGetDashboard(params);
  const d = q.data;
  const backTo = here;
  useScrollMemory(here, !!d);

  const actions = (
    <Button asChild className="h-11 lg:h-9">
      <Link href={withBack('/jobs/new', here)} data-testid="button-new-job">
        <Plus className="h-4 w-4" aria-hidden />
        {t('nav.newJob')}
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} actions={actions} />

      <div className="mb-6 rounded-xl border border-card-border bg-card px-4 py-3 shadow-[0_1px_2px_hsl(219_45%_20%/0.05)]">
        <DateRangeFields idPrefix="d" from={from} to={to} check={range.check} active={range.active} onChange={(p) => set(p)} />
      </div>

      {q.isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-xl" />)}
          </div>
          <LoadingBlock rows={6} />
        </div>
      ) : q.isError || !d ? (
        <ErrorState message={`${t('dashboard.error')} ${errText(q.error)}`} onRetry={() => void q.refetch()} />
      ) : d.totalJobs === 0 && d.draftCount === 0 && !params ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" aria-hidden />}
          title={t('dashboard.empty')}
          desc={ws.data?.isDemo ? t('dashboard.emptyDesc') : t('workspace.emptyPrivate')}
          action={actions}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7" role="group" aria-label={t('dashboard.kpiGroup')}>
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

          <div className="grid gap-5 lg:grid-cols-5">
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
              <ScrapReasonsDonut reasons={d.scrapReasons} />
            </Panel>
          </div>

          <Panel title={t('dashboard.perfTitle')} desc={t('dashboard.perfDesc')} testId="panel-performance">
            <LatestClosedScrap jobs={d.performanceJobs ?? []} backTo={backTo} />
          </Panel>

          <Panel title={t('dashboard.attention')} desc={t('dashboard.attentionDesc')} testId="panel-attention">
            {d.attentionJobs.length === 0 ? <p className="text-sm text-muted-foreground">{t('dashboard.noAttention')}</p> : <JobList jobs={d.attentionJobs} dense backTo={backTo} />}
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
            {d.recentJobs.length === 0 ? <p className="text-sm text-muted-foreground">{t('dashboard.noRecent')}</p> : <JobList jobs={d.recentJobs} backTo={backTo} />}
          </Panel>
        </div>
      )}
    </div>
  );
}
