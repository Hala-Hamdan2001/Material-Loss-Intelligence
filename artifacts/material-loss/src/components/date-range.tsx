import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFmt } from '@/lib/format';
import type { RangeCheck } from '@/lib/nav';
import { cn } from '@/lib/utils';

/** Human label for a validated (possibly open-ended) period. */
export function usePeriodLabel() {
  const { t } = useTranslation();
  const f = useFmt();
  return (r: { from: string; to: string }) =>
    !r.from && !r.to
      ? t('dashboard.allDates')
      : t('dashboard.periodLabel', { from: r.from ? f.date(r.from) : t('dashboard.openEnded'), to: r.to ? f.date(r.to) : t('dashboard.openEnded') });
}

export function DateRangeFields({
  idPrefix, from, to, onChange, check, active, className, compact = false,
}: {
  idPrefix: string;
  from: string;
  to: string;
  onChange: (patch: { from?: string; to?: string }) => void;
  check: RangeCheck;
  active: { from: string; to: string };
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const period = usePeriodLabel();
  const errId = `${idPrefix}-range-error`;
  const invalid = !check.ok;
  return (
    <div className={className}>
      <div className={cn('flex flex-wrap items-end gap-2.5', compact && 'grid grid-cols-2')} role="group" aria-label={t('dashboard.period')}>
        {!compact && <CalendarRange className="mb-3 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />}
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-from`} className="text-xs font-medium text-muted-foreground">{t('common.from')}</Label>
          <Input
            id={`${idPrefix}-from`} type="date" value={from} max={to || undefined}
            onChange={(e) => onChange({ from: e.target.value })}
            aria-invalid={invalid} aria-describedby={invalid ? errId : undefined}
            className={cn('mt-1 h-11 lg:h-9', !compact && 'w-[10.5rem]')} data-testid="input-from"
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-to`} className="text-xs font-medium text-muted-foreground">{t('common.to')}</Label>
          <Input
            id={`${idPrefix}-to`} type="date" value={to} min={from || undefined}
            onChange={(e) => onChange({ to: e.target.value })}
            aria-invalid={invalid} aria-describedby={invalid ? errId : undefined}
            className={cn('mt-1 h-11 lg:h-9', !compact && 'w-[10.5rem]')} data-testid="input-to"
          />
        </div>
        {!compact && (from || to) && (
          <Button variant="ghost" className="h-11 lg:h-9" onClick={() => onChange({ from: '', to: '' })} data-testid="button-clear-period">
            <X className="h-4 w-4" aria-hidden />
            {t('common.clear')}
          </Button>
        )}
      </div>
      {invalid && (
        <div id={errId} role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-rework/40 bg-rework/10 px-3 py-2 text-xs text-rework-ink" data-testid="alert-range-invalid">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {t(check.reason === 'order' ? 'dashboard.rangeInvalid' : 'dashboard.rangeBadDate')}{' '}
            {t('dashboard.rangeShowing', { period: period(active) })}
          </span>
        </div>
      )}
    </div>
  );
}
