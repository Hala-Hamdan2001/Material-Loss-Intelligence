import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { calculate } from '@workspace/material-accounting';
import { useGetReferenceData, type JobInput } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Panel, OutcomeBar } from '@/components/bits';
import { parseWeight, useFmt, isSystemReason, SELECTABLE_REASONS, missingForClose, useFieldList } from '@/lib/format';
import { cn } from '@/lib/utils';

type ScrapRow = { key: number; reason: string; custom: boolean; weight: string };
export type FormState = {
  reference: string; product: string; material: string; machine: string;
  issued: string; good: string; reusable: string; rework: string; notes: string;
  scrap: ScrapRow[];
};

let rowKey = 1;
export function emptyForm(): FormState {
  return { reference: '', product: '', material: '', machine: '', issued: '', good: '', reusable: '', rework: '', notes: '', scrap: [] };
}
export function formFromJob(j: JobInput): FormState {
  const s = (n: number) => (n ? String(n) : '');
  return {
    reference: j.reference, product: j.product, material: j.material, machine: j.machine,
    issued: s(j.issued), good: s(j.good), reusable: s(j.reusable), rework: s(j.rework), notes: j.notes,
    scrap: j.scrapEntries.map((e) => ({ key: rowKey++, reason: e.reason, custom: !isSystemReason(e.reason), weight: s(e.weight) })),
  };
}
function toInput(f: FormState): JobInput {
  return {
    reference: f.reference.trim(), product: f.product.trim(), material: f.material.trim(), machine: f.machine.trim(),
    issued: parseWeight(f.issued).value, good: parseWeight(f.good).value, reusable: parseWeight(f.reusable).value, rework: parseWeight(f.rework).value,
    scrapEntries: f.scrap.map((r) => ({ reason: r.reason.trim(), weight: parseWeight(r.weight).value })),
    notes: f.notes,
  };
}

type Props = {
  initial: FormState;
  tolerance: number;
  pending: boolean;
  serverError?: string | null;
  serverErrorAction?: React.ReactNode;
  onSubmit: (input: JobInput, close: boolean) => void;
  onCancel: () => void;
};

export function JobForm({ initial, tolerance, pending, serverError, serverErrorAction, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const f = useFmt();
  const ref = useGetReferenceData({ query: { staleTime: 60_000, queryKey: ['/api/reference-data'] } });
  const [form, setForm] = useState<FormState>(initial);
  const [touched, setTouched] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  const setRow = (key: number, patch: Partial<ScrapRow>) => setForm((p) => ({ ...p, scrap: p.scrap.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const input = useMemo(() => toInput(form), [form]);
  const m = useMemo(() => calculate(input, tolerance), [input, tolerance]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.reference.trim()) e.reference = t('form.errors.reference');
    (['issued', 'good', 'reusable', 'rework'] as const).forEach((k) => {
      if (!parseWeight(form[k]).valid) e[k] = t('form.errors.number');
    });
    form.scrap.forEach((r) => {
      const w = parseWeight(r.weight);
      if (!r.reason.trim()) e[`reason-${r.key}`] = t('form.errors.reason');
      if (!w.valid) e[`weight-${r.key}`] = t('form.errors.number');
      else if (w.value <= 0) e[`weight-${r.key}`] = t('form.errors.weight');
    });
    return e;
  }, [form, t]);
  const hasErrors = Object.keys(errors).length > 0;
  const missing = missingForClose(input);
  const listFields = useFieldList();
  const canClose = !hasErrors && m.balanced && input.issued > 0 && missing.length === 0;

  const submit = (close: boolean) => {
    setTouched(true);
    if (hasErrors) {
      errRef.current?.focus();
      return;
    }
    onSubmit(input, close);
  };
  const show = (k: string) => (touched ? errors[k] : undefined);

  const refData = ref.data;
  const reasonOptions = refData?.scrapReasons?.filter((r) => r !== 'unspecified_demo' && isSystemReason(r)) ?? [...SELECTABLE_REASONS];
  const customSuggestions = refData?.scrapReasons?.filter((r) => !isSystemReason(r)) ?? [];

  const textField = (k: 'reference' | 'product' | 'material' | 'machine', list?: string[]) => (
    <div className="min-w-0">
      <Label htmlFor={`f-${k}`} className="text-xs">
        {t(`form.${k}`)} {k === 'reference' && <span className="text-scrap">*</span>}
      </Label>
      <Input
        id={`f-${k}`}
        data-testid={`input-${k}`}
        value={form[k]}
        maxLength={k === 'reference' ? 80 : 200}
        list={list ? `dl-${k}` : undefined}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={!!show(k)}
        className={cn('mt-1 h-11 lg:h-9', show(k) && 'border-scrap')}
        autoComplete="off"
      />
      {list && (
        <datalist id={`dl-${k}`}>
          {list.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
      {show(k) && <p className="mt-1 text-xs text-scrap">{show(k)}</p>}
    </div>
  );

  const weightField = (k: 'issued' | 'good' | 'reusable' | 'rework', tone: string, hint?: string) => (
    <div className="min-w-0">
      <Label htmlFor={`f-${k}`} className="flex items-center gap-1.5 text-xs">
        {tone && <span className={cn('h-2.5 w-2.5 rounded-[2px]', tone)} aria-hidden />}
        {t(`form.${k}`)}
      </Label>
      <div className="relative mt-1">
        <Input
          id={`f-${k}`}
          data-testid={`input-${k}`}
          inputMode="decimal"
          dir="ltr"
          value={form[k]}
          onChange={(e) => set(k, e.target.value)}
          aria-invalid={!!errors[k]}
          aria-describedby={`h-${k}`}
          placeholder="0"
          className={cn('h-11 pe-10 text-end font-mono tnum lg:h-9', errors[k] && 'border-scrap')}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">{t('common.kg')}</span>
      </div>
      <p id={`h-${k}`} className={cn('mt-1 text-[11px]', errors[k] ? 'text-scrap' : 'text-muted-foreground')}>
        {errors[k] ?? hint}
      </p>
    </div>
  );

  const residualAbs = Math.abs(m.residual);
  let balanceMsg: string;
  if (input.issued <= 0) balanceMsg = t('balance.zeroIssued');
  else if (m.balanced) balanceMsg = t('balance.insideTol', { value: f.signedKg(m.residual) });
  else if (m.residual > 0) balanceMsg = t('balance.under', { value: f.kg(residualAbs) });
  else balanceMsg = t('balance.over', { value: f.kg(residualAbs) });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <Panel title={t('form.identity')} desc={t('form.suggestions')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {textField('reference')}
            {textField('product', refData?.products)}
            {textField('material', refData?.materials)}
            {textField('machine', refData?.machines)}
          </div>
        </Panel>

        <Panel title={t('form.weights')} desc={t('form.numHint')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {weightField('issued', 'bg-primary')}
            {weightField('good', 'bg-good', t('outcome.goodHint'))}
            {weightField('reusable', 'bg-reusable', t('outcome.reusableHint'))}
            {weightField('rework', 'bg-rework', t('outcome.reworkHint'))}
          </div>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-scrap" aria-hidden />
              {t('form.scrapTitle')}
            </span>
          }
          desc={t('outcome.scrapHint')}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => set('scrap', [...form.scrap, { key: rowKey++, reason: '', custom: false, weight: '' }])} data-testid="button-add-scrap">
              <Plus className="h-4 w-4" aria-hidden />
              {t('form.addScrap')}
            </Button>
          }
        >
          {form.scrap.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('form.scrapEmpty')}</p>
          ) : (
            <ol className="space-y-3">
              {form.scrap.map((r, i) => {
                const selectVal = r.custom ? '__custom' : r.reason;
                return (
                  <li key={r.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-start" data-testid={`row-scrap-${i}`}>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor={`sr-${r.key}`} className="text-xs">
                        {t('form.reason')} {i + 1}
                      </Label>
                      <select
                        id={`sr-${r.key}`}
                        data-testid={`select-reason-${i}`}
                        value={selectVal}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom') setRow(r.key, { custom: true, reason: '' });
                          else setRow(r.key, { custom: false, reason: v });
                        }}
                        className={cn('h-11 w-full rounded-md border border-input bg-card px-2 text-sm lg:h-9', show(`reason-${r.key}`) && !r.custom && 'border-scrap')}
                      >
                        <option value="">{t('reasons.choose')}</option>
                        {reasonOptions.map((code) => (
                          <option key={code} value={code}>
                            {t(`reasons.${code}`)}
                          </option>
                        ))}
                        {r.reason === 'unspecified_demo' && <option value="unspecified_demo">{t('reasons.unspecified_demo')}</option>}
                        <option value="__custom">{t('reasons.custom')}</option>
                      </select>
                      {r.custom && (
                        <>
                          <Input
                            aria-label={t('reasons.custom')}
                            data-testid={`input-custom-reason-${i}`}
                            value={r.reason}
                            maxLength={200}
                            list="dl-custom-reasons"
                            placeholder={t('form.customPh')}
                            onChange={(e) => setRow(r.key, { reason: e.target.value })}
                            className={cn('h-11 lg:h-9', show(`reason-${r.key}`) && 'border-scrap')}
                          />
                        </>
                      )}
                      {show(`reason-${r.key}`) && <p className="text-xs text-scrap">{show(`reason-${r.key}`)}</p>}
                    </div>
                    <div>
                      <Label htmlFor={`sw-${r.key}`} className="text-xs">
                        {t('form.weight')}
                      </Label>
                      <div className="relative mt-2">
                        <Input
                          id={`sw-${r.key}`}
                          data-testid={`input-scrap-weight-${i}`}
                          inputMode="decimal"
                          dir="ltr"
                          placeholder="0"
                          value={r.weight}
                          onChange={(e) => setRow(r.key, { weight: e.target.value })}
                          className={cn('h-11 pe-10 text-end font-mono tnum lg:h-9', (show(`weight-${r.key}`) || !parseWeight(r.weight).valid) && 'border-scrap')}
                        />
                        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">{t('common.kg')}</span>
                      </div>
                      {(show(`weight-${r.key}`) || (!parseWeight(r.weight).valid && errors[`weight-${r.key}`])) && <p className="mt-1 text-xs text-scrap">{errors[`weight-${r.key}`]}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 justify-self-end text-muted-foreground lg:mt-6 lg:h-9 lg:w-9"
                      aria-label={t('form.removeScrap', { n: i + 1 })}
                      onClick={() => set('scrap', form.scrap.filter((x) => x.key !== r.key))}
                      data-testid={`button-remove-scrap-${i}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
          <datalist id="dl-custom-reasons">
            {customSuggestions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Panel>

        <Panel title={t('form.notesTitle')}>
          <Label htmlFor="f-notes" className="text-xs">
            {t('form.notes')} <span className="text-muted-foreground">({t('common.optional')})</span>
          </Label>
          <Textarea id="f-notes" data-testid="input-notes" value={form.notes} maxLength={4000} onChange={(e) => set('notes', e.target.value)} placeholder={t('form.notesPh')} className="mt-1 min-h-24" />
        </Panel>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <Panel
          testId="panel-balance"
          title={
            <span className="flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-primary" aria-hidden />
              {t('balance.title')}
            </span>
          }
          desc={t('balance.equation')}
        >
          <div aria-live="polite" className="space-y-3">
            <div className={cn('flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold', m.balanced && input.issued > 0 ? 'bg-good/10 text-good' : 'bg-scrap/10 text-scrap')} data-testid="status-balance">
              {m.balanced && input.issued > 0 ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
              {m.balanced && input.issued > 0 ? t('balance.balanced') : t('balance.unbalanced')}
            </div>
            <dl className="tnum space-y-1 font-mono text-sm">
              {[
                ['outcome.issued', input.issued, 'font-semibold'],
                ['outcome.good', input.good, 'text-good'],
                ['outcome.reusable', input.reusable, 'text-reusable'],
                ['outcome.rework', input.rework, 'text-rework-ink'],
                ['outcome.scrap', m.scrap, 'text-scrap'],
                ['outcome.accounted', m.accounted, 'border-t border-border pt-1'],
              ].map(([k, v, cls]) => (
                <div key={k as string} className={cn('flex justify-between gap-2', cls as string)}>
                  <dt className="font-sans">{t(k as string)}</dt>
                  <dd>{f.kg(v as number)}</dd>
                </div>
              ))}
              <div className={cn('flex justify-between gap-2 rounded-sm border px-2 py-1 font-semibold', m.balanced ? 'border-border' : 'border-scrap/40 text-scrap')}>
                <dt className="font-sans">{t('outcome.residual')}</dt>
                <dd data-testid="text-residual">{f.signedKg(m.residual)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">{t('balance.tolerance', { value: f.kg(tolerance) })}</p>
            <p className={cn('text-sm', m.balanced && input.issued > 0 ? 'text-muted-foreground' : 'text-foreground')} data-testid="text-balance-message">
              {balanceMsg}
            </p>
            {input.issued > 0 && (
              <OutcomeBar
                compact
                issued={input.issued}
                label={t('balance.title')}
                parts={[
                  { key: 'good', value: input.good },
                  { key: 'reusable', value: input.reusable },
                  { key: 'rework', value: input.rework },
                  { key: 'scrap', value: m.scrap },
                  { key: 'residual', value: Math.max(0, m.residual) },
                ]}
              />
            )}
            {input.issued > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>{t('metrics.yield')}: <span className="font-mono">{f.pct(m.yieldPercent)}</span></div>
                <div>{t('metrics.scrapRate')}: <span className="font-mono">{f.pct(m.scrapPercent)}</span></div>
                <div>{t('metrics.reusableRate')}: <span className="font-mono">{f.pct(m.reusablePercent)}</span></div>
                <div>{t('metrics.reworkRate')}: <span className="font-mono">{f.pct(m.reworkPercent)}</span></div>
              </div>
            )}
          </div>

          <div ref={errRef} tabIndex={-1} className="mt-4 space-y-2 outline-none">
            {touched && hasErrors && (
              <p role="alert" className="rounded-sm bg-scrap/10 px-2 py-1.5 text-xs text-scrap">
                {t('form.errors.fix')}
              </p>
            )}
            {serverError && (
              <div role="alert" className="space-y-2 rounded-sm bg-scrap/10 px-2 py-1.5 text-xs text-scrap" data-testid="text-server-error">
                <p>{serverError}</p>
                {serverErrorAction}
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-2">
            <Button className="h-11 lg:h-9" disabled={pending} onClick={() => submit(false)} data-testid="button-save-draft">
              {pending ? t('form.saving') : t('form.saveDraft')}
            </Button>
            <Button variant="outline" className="h-11 lg:h-9" disabled={pending || !canClose} onClick={() => submit(true)} data-testid="button-save-close">
              {t('form.saveClose')}
            </Button>
            {!canClose && <p className="text-[11px] text-muted-foreground">{t('form.closeBlocked')}</p>}
            {missing.length > 0 && <p className="text-[11px] text-rework-ink" data-testid="text-close-missing">{t('form.closeMissing', { fields: listFields(missing) })}</p>}
            <Button variant="ghost" className="h-11 lg:h-9" onClick={onCancel} disabled={pending} data-testid="button-cancel">
              {t('form.leave')}
            </Button>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
