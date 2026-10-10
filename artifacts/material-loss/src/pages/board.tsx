import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Inbox, AlertTriangle, CheckCircle2, MessageSquareText, Info } from 'lucide-react';
import type { Job } from '@workspace/api-client-react';
import { PageHeader, ErrorState, StatusBadge, Signals } from '@/components/bits';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoard } from '@/lib/board-api';
import { withBack } from '@/lib/nav';
import { useErrorText, useFmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type ColKey = 'jobs' | 'investigation' | 'closed';

const TONE: Record<ColKey, string> = {
  jobs: 'border-t-primary',
  investigation: 'border-t-scrap',
  closed: 'border-t-good',
};

function BoardCard({ job, col }: { job: Job; col: ColKey }) {
  const { t } = useTranslation();
  const f = useFmt();
  const notes = job.investigationNotes.length;
  return (
    <li>
      <Link
        href={withBack(`/jobs/${job.id}`, '/board')}
        aria-label={t('jobs.open', { ref: job.reference || job.id })}
        className="block rounded-lg border border-card-border bg-card p-3 shadow-[0_1px_2px_hsl(219_45%_20%/0.05)] transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`board-card-${job.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-mono text-sm font-semibold text-primary" dir="ltr">{job.reference || t('common.emptyValue')}</span>
          <span className="shrink-0" title={t('board.accounting')}><StatusBadge status={job.status} /></span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {[job.product, job.material, job.machine].filter(Boolean).join(' · ') || t('common.emptyValue')}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
          <div><dt className="text-muted-foreground">{t('outcome.issued')}</dt><dd className="tnum font-mono">{f.kg(job.issued)}</dd></div>
          <div><dt className="text-muted-foreground">{t('metrics.scrapRate')}</dt><dd className="tnum font-mono text-scrap">{f.pct(job.metrics.scrapPercent)}</dd></div>
        </dl>
        {(job.signals.length > 0 || notes > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Signals signals={job.signals} />
            {notes > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                <MessageSquareText className="h-3 w-3" aria-hidden />
                {t('board.notes', { count: notes })}
              </span>
            )}
          </div>
        )}
        {col === 'investigation' && job.status === 'closed' && (
          <p className="mt-2 text-[11px] text-muted-foreground">{t('board.closedButOpen')}</p>
        )}
      </Link>
    </li>
  );
}

function Column({ col, title, desc, icon, jobs }: { col: ColKey; title: string; desc: string; icon: ReactNode; jobs: Job[] }) {
  const { t } = useTranslation();
  const f = useFmt();
  return (
    <section aria-labelledby={`col-${col}`} className={cn('flex min-w-0 flex-col rounded-xl border border-t-[3px] border-card-border bg-muted/40 p-3', TONE[col])} data-testid={`board-col-${col}`}>
      <header className="mb-3 flex items-start gap-2 px-1">
        <span className="mt-0.5 text-muted-foreground" aria-hidden>{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 id={`col-${col}`} className="flex items-center gap-2 text-sm font-semibold">
            {title}
            <span className="tnum rounded-full bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{f.num(jobs.length)}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </header>
      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{t('board.emptyCol')}</p>
      ) : (
        <ul className="space-y-2">{jobs.map((j) => <BoardCard key={j.id} job={j} col={col} />)}</ul>
      )}
    </section>
  );
}

export default function BoardPage() {
  const { t } = useTranslation();
  const errText = useErrorText();
  const q = useBoard();
  return (
    <div>
      <PageHeader title={t('board.title')} subtitle={t('board.subtitle')} />
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground" data-testid="text-board-explain">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{t('board.explain')}</p>
      </div>
      {q.isLoading ? (
        <div className="grid gap-3 md:grid-cols-3" role="status" aria-label={t('common.loading')}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-card-border p-3">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 3 }).map((__, k) => <Skeleton key={k} className="h-24" />)}
            </div>
          ))}
        </div>
      ) : q.isError || !q.data ? (
        <ErrorState message={`${t('board.error')} ${errText(q.error)}`} onRetry={() => void q.refetch()} />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <Column col="jobs" title={t('board.colJobs')} desc={t('board.colJobsDesc')} icon={<Inbox className="h-4 w-4" />} jobs={q.data.jobs} />
          <Column col="investigation" title={t('board.colInvestigation')} desc={t('board.colInvestigationDesc')} icon={<AlertTriangle className="h-4 w-4" />} jobs={q.data.investigation} />
          <Column col="closed" title={t('board.colClosed')} desc={t('board.colClosedDesc')} icon={<CheckCircle2 className="h-4 w-4" />} jobs={q.data.closed} />
        </div>
      )}
    </div>
  );
}
