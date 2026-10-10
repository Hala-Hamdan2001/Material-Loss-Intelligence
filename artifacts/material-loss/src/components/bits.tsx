import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, TrendingUp, History, CircleDashed, CheckCircle2, RotateCw } from 'lucide-react';
import type { Job, JobSignalsItem } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFmt } from '@/lib/format-shared';
import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: Job['status'] }) {
  const { t } = useTranslation();
  const closed = status === 'closed';
  return (
    <span
      data-testid={`status-${status}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        closed ? 'border-primary/30 bg-primary/8 text-primary' : 'border-dashed border-muted-foreground/50 text-muted-foreground',
      )}
    >
      {closed ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <CircleDashed className="h-3 w-3" aria-hidden />}
      {t(`status.${status}`)}
    </span>
  );
}

const SIGNAL_STYLE: Record<JobSignalsItem, { cls: string; Icon: typeof AlertTriangle }> = {
  high_scrap: { cls: 'border-scrap/40 bg-scrap/10 text-scrap', Icon: AlertTriangle },
  above_baseline: { cls: 'border-rework/50 bg-rework/12 text-rework-ink', Icon: TrendingUp },
  insufficient_history: { cls: 'border-border bg-muted text-muted-foreground', Icon: History },
};

export function SignalBadge({ signal }: { signal: JobSignalsItem }) {
  const { t } = useTranslation();
  const s = SIGNAL_STYLE[signal];
  if (!s) return null;
  return (
    <span data-testid={`signal-${signal}`} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', s.cls)}>
      <s.Icon className="h-3 w-3" aria-hidden />
      {t(`signals.${signal}`)}
    </span>
  );
}

export function Signals({ signals }: { signals: JobSignalsItem[] }) {
  if (!signals.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((s) => (
        <SignalBadge key={s} signal={s} />
      ))}
    </div>
  );
}

export const OUTCOME_COLORS = {
  good: 'bg-good',
  reusable: 'bg-reusable',
  rework: 'bg-rework',
  scrap: 'bg-scrap',
  residual: 'bg-muted-foreground/40',
} as const;
export type OutcomeKey = keyof typeof OUTCOME_COLORS;

/** Stacked horizontal bar of outcomes by weight, with a textual legend that doubles as the text equivalent. */
export function OutcomeBar({ issued, parts, compact = false, label }: { issued: number; parts: { key: OutcomeKey; value: number }[]; compact?: boolean; label?: string }) {
  const { t } = useTranslation();
  const f = useFmt();
  const total = Math.max(issued, parts.reduce((a, p) => a + Math.max(0, p.value), 0));
  const share = (v: number) => (total > 0 ? (Math.max(0, v) / total) * 100 : 0);
  const desc = parts.map((p) => `${t(`outcome.${p.key}`)} ${f.kg(p.value)} (${f.pct(share(p.value))})`).join('; ');
  return (
    <div>
      <div role="img" aria-label={`${label ?? t('dashboard.chartLabel')}: ${desc}`} className={cn('flex w-full gap-px overflow-hidden rounded-full bg-muted', compact ? 'h-1.5' : 'h-3.5')}>
        {parts.map((p) =>
          share(p.value) > 0 ? <div key={p.key} className={OUTCOME_COLORS[p.key]} style={{ width: `${share(p.value)}%` }} /> : null,
        )}
      </div>
      {!compact && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {parts.map((p) => (
            <div key={p.key} className="min-w-0" data-testid={`legend-${p.key}`}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-[2px]', OUTCOME_COLORS[p.key])} aria-hidden />
                {t(`outcome.${p.key}`)}
              </dt>
              <dd className="tnum font-mono text-sm font-medium">
                {f.kg(p.value)} <span className="text-muted-foreground">{f.pct(share(p.value))}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function Panel({ title, desc, action, children, className, testId }: { title?: ReactNode; desc?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cn('min-w-0 rounded-xl border border-card-border bg-card shadow-[0_1px_2px_hsl(219_45%_20%/0.05),0_4px_16px_-8px_hsl(219_45%_20%/0.08)]', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-5 pb-1 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-scrap/30 bg-scrap/5 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-scrap">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {message}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry">
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <div className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      {desc && <p className="max-w-sm text-sm text-muted-foreground">{desc}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 4, label }: { rows?: number; label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={label ?? t('common.loading')} className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
      <span className="sr-only">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function Stat({ label, value, sub, tone, testId }: { label: string; value: string; sub?: string; tone?: 'good' | 'scrap' | 'reusable' | 'rework'; testId?: string }) {
  const dot = tone ? { good: 'bg-good', scrap: 'bg-scrap', reusable: 'bg-reusable', rework: 'bg-rework' }[tone] : 'bg-primary';
  return (
    <div data-testid={testId} className="min-w-0 rounded-xl border border-card-border bg-card px-4 py-3 shadow-[0_1px_2px_hsl(219_45%_20%/0.05)]">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />
        {label}
      </div>
      <div className="tnum mt-1 break-words font-mono text-xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DemoTag() {
  const { t } = useTranslation();
  return <span className="rounded-full bg-rework/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-rework-ink">{t('detail.demoBadge')}</span>;
}
