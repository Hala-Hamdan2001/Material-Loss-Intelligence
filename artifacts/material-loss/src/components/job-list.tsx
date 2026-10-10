import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { Job } from '@workspace/api-client-react';
import { StatusBadge, Signals, OutcomeBar, DemoTag } from '@/components/bits';
import { useFmt } from '@/lib/format';
import { withBack } from '@/lib/nav';

function parts(j: Job) {
  return [
    { key: 'good' as const, value: j.good },
    { key: 'reusable' as const, value: j.reusable },
    { key: 'rework' as const, value: j.rework },
    { key: 'scrap' as const, value: j.metrics.scrap },
    { key: 'residual' as const, value: Math.max(0, j.metrics.residual) },
  ];
}

function Dash({ v }: { v: string }) {
  const { t } = useTranslation();
  return v ? <>{v}</> : <span className="text-muted-foreground">{t('common.emptyValue')}</span>;
}

/** `backTo` is the validated source page (list or dashboard, with query) carried to detail/edit. */
export function JobList({ jobs, dense = false, backTo }: { jobs: Job[]; dense?: boolean; backTo?: string }) {
  const { t } = useTranslation();
  const f = useFmt();
  const hrefOf = (id: string) => withBack(`/jobs/${id}`, backTo);
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="py-2.5 pe-3 text-start font-medium">{t('jobs.reference')}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t('jobs.product')} / {t('jobs.material')}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t('jobs.machine')}</th>
              <th className="px-3 py-2.5 text-end font-medium">{t('outcome.issued')}</th>
              <th className="px-3 py-2.5 text-end font-medium">{t('metrics.yield')}</th>
              <th className="px-3 py-2.5 text-end font-medium">{t('metrics.scrapRate')}</th>
              {!dense && <th className="w-32 px-3 py-3 text-start font-medium">{t('dashboard.outcomes')}</th>}
              <th className="px-3 py-2.5 text-start font-medium">{t('jobs.status')}</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="group border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40" data-testid={`row-job-${j.id}`}>
                <td className="py-3 pe-3 align-top">
                  <Link href={hrefOf(j.id)} className="rounded font-mono font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`link-job-${j.id}`}>
                    {j.reference}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {f.date(j.closedAt ?? j.createdAt)} {j.isDemo && <DemoTag />}
                  </div>
                </td>
                <td className="max-w-56 px-3 py-3 align-top">
                  <div className="truncate"><Dash v={j.product} /></div>
                  <div className="truncate text-xs text-muted-foreground">{j.material}</div>
                </td>
                <td className="px-3 py-3 align-top"><Dash v={j.machine} /></td>
                <td className="tnum px-3 py-3 text-end align-top font-mono">{f.kg(j.issued)}</td>
                <td className="tnum px-3 py-3 text-end align-top font-mono text-good">{f.pct(j.metrics.yieldPercent)}</td>
                <td className="tnum px-3 py-3 text-end align-top font-mono text-scrap">{f.pct(j.metrics.scrapPercent)}</td>
                {!dense && (
                  <td className="px-3 py-3 align-top pt-3.5">
                    <OutcomeBar compact issued={j.issued} parts={parts(j)} label={j.reference} />
                  </td>
                )}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={j.status} />
                    <Signals signals={j.signals} />
                  </div>
                </td>
                <td className="py-2 align-top">
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 rtl:rotate-180" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link
              href={hrefOf(j.id)}
              aria-label={t('jobs.open', { ref: j.reference })}
              className="block rounded-xl border border-card-border bg-card p-4 shadow-[0_1px_2px_hsl(219_45%_20%/0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent"
              data-testid={`card-job-${j.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono font-semibold text-primary">{j.reference}</div>
                  <div className="truncate text-sm"><Dash v={j.product} /></div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[j.material, j.machine].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <StatusBadge status={j.status} />
              </div>
              <div className="mt-2">
                <OutcomeBar compact issued={j.issued} parts={parts(j)} label={j.reference} />
              </div>
              <div className="tnum mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
                <div><div className="font-sans text-muted-foreground">{t('outcome.issued')}</div>{f.kg(j.issued)}</div>
                <div className="text-good"><div className="font-sans text-muted-foreground">{t('metrics.yield')}</div>{f.pct(j.metrics.yieldPercent)}</div>
                <div className="text-scrap"><div className="font-sans text-muted-foreground">{t('metrics.scrapRate')}</div>{f.pct(j.metrics.scrapPercent)}</div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                {f.date(j.closedAt ?? j.createdAt)} {j.isDemo && <DemoTag />}
                <Signals signals={j.signals} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
