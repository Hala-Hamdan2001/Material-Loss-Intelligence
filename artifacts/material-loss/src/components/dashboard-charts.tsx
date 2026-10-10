import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { Job, ReasonTotal } from '@workspace/api-client-react';
import { useFmt, useReasonLabel } from '@/lib/format';
import { withBack } from '@/lib/nav';
import { cn } from '@/lib/utils';

/* ---------------- Latest closed jobs: scrap rate ---------------- */

type PerfRow = { id: string; reference: string; scrapPercent: number; job: Job };

function PerfTooltip({ active, payload }: { active?: boolean; payload?: { payload: PerfRow }[] }) {
  const { t } = useTranslation();
  const f = useFmt();
  if (!active || !payload || !payload.length) return null;
  const j = payload[0].payload.job;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="font-mono font-semibold text-foreground" dir="ltr">{j.reference}</div>
      <div className="mt-0.5 text-muted-foreground">{[j.product, j.material, j.machine].filter(Boolean).join(' · ')}</div>
      <div className="tnum mt-1.5 flex gap-3 font-mono">
        <span className="text-scrap">{t('metrics.scrapRate')} {f.pct(j.metrics.scrapPercent)}</span>
        <span>{t('dashboard.issuedShort')} {f.kg(j.issued)}</span>
      </div>
    </div>
  );
}

export function LatestClosedScrap({ jobs, backTo }: { jobs: Job[]; backTo: string }) {
  const { t, i18n } = useTranslation();
  const f = useFmt();
  const [, navigate] = useLocation();
  const rtl = i18n.dir() === 'rtl';

  if (jobs.length === 0) {
    return <p className="rounded-lg bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="text-perf-empty">{t('dashboard.perfEmpty')}</p>;
  }
  const rows: PerfRow[] = jobs.map((j) => ({ id: j.id, reference: j.reference, scrapPercent: j.metrics.scrapPercent, job: j }));
  const allZero = rows.every((r) => r.scrapPercent <= 0);
  const showChart = rows.length > 1;

  return (
    <div className="space-y-4">
      {showChart && (
        <div role="img" aria-label={`${t('dashboard.perfChartLabel')}: ${rows.map((r) => `${r.reference} ${f.pct(r.scrapPercent)}`).join('; ')}`} className="h-[236px] w-full" data-testid="chart-perf">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: rtl ? 4 : 48, left: rtl ? 48 : 4, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
              <XAxis type="number" domain={[0, (max: number) => (max > 0 ? Math.ceil(max * 1.15) : 1)]} reversed={rtl} tickFormatter={(v: number) => f.pct(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="reference" orientation={rtl ? 'right' : 'left'} width={96} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontFamily: 'var(--app-font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.6)' }} content={<PerfTooltip />} />
              <Bar
                dataKey="scrapPercent"
                fill="hsl(var(--scrap))"
                radius={rtl ? [6, 0, 0, 6] : [0, 6, 6, 0]}
                maxBarSize={22}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(d: { id?: string }) => d?.id && navigate(withBack(`/jobs/${d.id}`, backTo))}
                label={{ position: rtl ? 'left' : 'right', fontSize: 11, fill: 'hsl(var(--foreground))', formatter: (v: number) => f.pct(v) }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {(rows.length === 1 || allZero) && (
        <p className="text-xs text-muted-foreground" data-testid="text-perf-note">{rows.length === 1 ? t('dashboard.perfSingle') : t('dashboard.perfZero')}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={t('dashboard.perfTable')}>
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="py-2 pe-3 text-start font-medium">{t('jobs.reference')}</th>
              <th className="hidden px-3 py-2 text-start font-medium sm:table-cell">{t('jobs.product')} · {t('jobs.material')} · {t('jobs.machine')}</th>
              <th className="px-3 py-2 text-end font-medium">{t('dashboard.issuedShort')}</th>
              <th className="ps-3 py-2 text-end font-medium">{t('metrics.scrapRate')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0" data-testid={`row-perf-${r.id}`}>
                <td className="py-2 pe-3 align-top">
                  <Link href={withBack(`/jobs/${r.id}`, backTo)} className="rounded font-mono font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`link-perf-${r.id}`}>
                    {r.reference}
                  </Link>
                  {r.job.closedAt && <div className="text-[11px] text-muted-foreground">{f.date(r.job.closedAt)}</div>}
                </td>
                <td className="hidden max-w-72 px-3 py-2 align-top text-xs text-muted-foreground sm:table-cell">
                  <span className="line-clamp-2">{[r.job.product, r.job.material, r.job.machine].filter(Boolean).join(' · ') || t('common.emptyValue')}</span>
                </td>
                <td className="tnum px-3 py-2 text-end align-top font-mono text-xs">{f.kg(r.job.issued)}</td>
                <td className="tnum ps-3 py-2 text-end align-top font-mono text-xs font-semibold text-scrap">{f.pct(r.scrapPercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Scrap by recorded reason: donut ---------------- */

// Categorical palette (colour-blind-aware order); the unspecified legacy reason is always neutral grey.
const REASON_COLORS = ['#1F74AD', '#61A9BD', '#E98E2E', '#9267C6', '#8D6C5B', '#3C7686', '#AB6821', '#DD83C9'];
const UNSPECIFIED = '#979797';

export function ScrapReasonsDonut({ reasons }: { reasons: ReasonTotal[] }) {
  const { t } = useTranslation();
  const f = useFmt();
  const reasonLabel = useReasonLabel();
  const positive = reasons.filter((r) => r.weight > 0);
  if (positive.length === 0) return <p className="text-sm text-muted-foreground">{t('dashboard.noReasons')}</p>;
  let ci = 0;
  const data = positive.map((r) => ({
    ...r,
    label: reasonLabel(r.reason),
    color: r.reason === 'unspecified_demo' ? UNSPECIFIED : REASON_COLORS[ci++ % REASON_COLORS.length],
  }));
  const total = data.reduce((a, r) => a + r.weight, 0);
  return (
    <div className="grid min-w-0 items-center gap-5">
      <div className="relative mx-auto h-[180px] w-[180px]" role="img" aria-label={`${t('dashboard.donutChartLabel')}: ${data.map((r) => `${r.label} ${f.kg(r.weight)} (${f.pct(r.contribution)})`).join('; ')}`} data-testid="chart-reasons">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="weight" nameKey="label" innerRadius={58} outerRadius={86} paddingAngle={data.length > 1 ? 2 : 0} stroke="hsl(var(--card))" strokeWidth={2} isAnimationActive={false}>
              {data.map((r) => <Cell key={r.reason} fill={r.color} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const r = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                    <div className="font-medium">{r.label}</div>
                    <div className="tnum font-mono">{f.kg(r.weight)} · {f.pct(r.contribution)}</div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-hidden>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('dashboard.donutCenter')}</div>
            <div className="tnum font-mono text-base font-semibold">{f.kg(total)}</div>
          </div>
        </div>
      </div>
      <table className="w-full table-fixed text-sm">
        <thead className="sr-only">
          <tr><th>{t('dashboard.reasonCol')}</th><th>{t('dashboard.weightCol')}</th><th>{t('dashboard.shareCol')}</th></tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.reason} className="border-b border-border/60 last:border-0" data-testid={`reason-${i}`}>
              <td className="py-2 pe-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                  <span className={cn('min-w-0 break-words', r.reason === 'unspecified_demo' && 'text-muted-foreground')}>{r.label}</span>
                </span>
              </td>
              <td className="tnum py-2 px-2 text-end font-mono text-xs">{f.kg(r.weight)}</td>
              <td className="tnum py-2 ps-2 text-end font-mono text-xs text-muted-foreground">{f.pct(r.contribution)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
