import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Inbox, SearchX, Download } from 'lucide-react';
import { useGetWorkspace, getGetWorkspaceQueryKey, useListJobs, useGetReferenceData, getGetReferenceDataQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Panel, ErrorState, EmptyState, LoadingBlock } from '@/components/bits';
import { JobList } from '@/components/job-list';
import { DateRangeFields } from '@/components/date-range';
import { withBack } from '@/lib/nav';
import { useUrlParams, useValidRange, useScrollMemory } from '@/hooks/use-nav';
import { cleanParams, errorCode, useErrorText, useFmt } from '@/lib/format';
import { downloadJobsCsv } from '@/lib/board-api';

const KEYS = ['search', 'from', 'to', 'machine', 'material', 'status'] as const;

const selectCls = 'mt-1 h-11 w-full rounded-lg border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring lg:h-9';

export default function Jobs() {
  const { t } = useTranslation();
  const f = useFmt();
  const errText = useErrorText();
  const ref = useGetReferenceData({ query: { staleTime: 60_000, queryKey: getGetReferenceDataQueryKey() } });
  const { values, set, here } = useUrlParams(KEYS);
  const { search, from, to, machine, material } = values;
  // Unknown status values from a hand-edited URL are ignored rather than sent to the API.
  const status = values.status === 'draft' || values.status === 'closed' ? values.status : '';
  const [searchInput, setSearchInput] = useState(search);
  const setRef = useRef(set);
  setRef.current = set;
  // Keep the box in sync with Back/Forward; debounce typing into the URL.
  const lastPushed = useRef(search);
  useEffect(() => {
    if (search !== lastPushed.current) { lastPushed.current = search; setSearchInput(search); }
  }, [search]);
  useEffect(() => {
    const next = searchInput.trim();
    if (next === lastPushed.current) return;
    const id = window.setTimeout(() => { lastPushed.current = next; setRef.current({ search: next }); }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const range = useValidRange(from, to);
  const params = cleanParams({ search, machine, material, status, ...range.active });
  const q = useListJobs(params);
  const filtered = !!params || !range.check.ok;
  useScrollMemory(here, !!q.data);
  const qc = useQueryClient();
  const ws = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey() } });
  const canExport = !!ws.data && ws.data.role !== 'worker';
  const [exporting, setExporting] = useState(false);
  const exportRequest = useRef<AbortController | null>(null);
  useEffect(() => () => exportRequest.current?.abort(), []);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportCsv = async () => {
    setExporting(true); setExportError(null);
    const controller = new AbortController();
    exportRequest.current = controller;
    try {
      await downloadJobsCsv(params, controller.signal);
    } catch (e) {
      if (controller.signal.aborted) return;
      setExportError(`${t('jobs.exportError')} ${errText(e)}`);
      if (['FORBIDDEN', 'UNAUTHORIZED'].includes(errorCode(e))) void qc.invalidateQueries({ queryKey: ['/api/workspace'], exact: true });
    } finally { setExporting(false); }
  };
  const clear = () => {
    setSearchInput(''); lastPushed.current = '';
    set({ search: '', from: '', to: '', machine: '', material: '', status: '' });
  };

  return (
    <div>
      <PageHeader
        title={t('jobs.title')}
        subtitle={t('jobs.subtitle')}
        actions={
          <>
          {canExport && (
            <Button variant="outline" className="h-11 lg:h-9" disabled={exporting} onClick={() => void exportCsv()} title={t('jobs.exportHint')} data-testid="button-export-csv">
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? t('jobs.exporting') : t('jobs.export')}
            </Button>
          )}
          <Button asChild className="h-11 lg:h-9">
            <Link href={withBack('/jobs/new', here)} data-testid="button-new-job">
              <Plus className="h-4 w-4" aria-hidden />
              {t('nav.newJob')}
            </Link>
          </Button>
          </>
        }
      />
      {exportError && (
        <div role="alert" className="mb-3 rounded-md border border-scrap/50 bg-scrap/10 px-3 py-2 text-sm" data-testid="alert-export-error">{exportError}</div>
      )}
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <div className="sm:col-span-2 lg:col-span-2">
            <Label htmlFor="j-search" className="text-xs">{t("jobs.search")}</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="j-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t('jobs.search')} aria-label={t('jobs.search')} className="h-11 ps-8 lg:h-9" data-testid="input-search" />
            </div>
          </div>
          <div>
            <Label htmlFor="j-machine" className="text-xs">{t('jobs.machine')}</Label>
            <select id="j-machine" value={machine} onChange={(e) => set({ machine: e.target.value })} className={selectCls} data-testid="select-machine">
              <option value="">{t('jobs.allMachines')}</option>
              {ref.data?.machines.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="j-material" className="text-xs">{t('jobs.material')}</Label>
            <select id="j-material" value={material} onChange={(e) => set({ material: e.target.value })} className={selectCls} data-testid="select-material">
              <option value="">{t('jobs.allMaterials')}</option>
              {ref.data?.materials.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="j-status" className="text-xs">{t('jobs.status')}</Label>
            <select id="j-status" value={status} onChange={(e) => set({ status: e.target.value })} className={selectCls} data-testid="select-status">
              <option value="">{t('status.all')}</option>
              <option value="draft">{t('status.draft')}</option>
              <option value="closed">{t('status.closed')}</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <DateRangeFields compact idPrefix="j" from={from} to={to} check={range.check} active={range.active} onChange={(p) => set(p)} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span aria-live="polite" data-testid="text-results">
            {q.data ? t('jobs.results', { count: q.data.length }).replace(String(q.data.length), f.num(q.data.length)) : '\u00a0'}
          </span>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={clear} data-testid="button-clear-filters">
              {t('common.clear')}
            </Button>
          )}
        </div>
      </Panel>

      <div className="mt-4">
        {q.isLoading ? (
          <LoadingBlock rows={8} />
        ) : q.isError ? (
          <ErrorState message={`${t('jobs.error')} ${errText(q.error)}`} onRetry={() => void q.refetch()} />
        ) : !q.data || q.data.length === 0 ? (
          filtered ? (
            <EmptyState icon={<SearchX className="h-5 w-5" aria-hidden />} title={t('jobs.noMatch')} desc={t('jobs.noMatchDesc')} action={<Button variant="outline" onClick={clear}>{t('common.clear')}</Button>} />
          ) : (
            <EmptyState icon={<Inbox className="h-5 w-5" aria-hidden />} title={t('jobs.empty')} desc={t('jobs.emptyDesc')} action={<Button asChild><Link href="/jobs/new">{t('nav.newJob')}</Link></Button>} />
          )
        ) : (
          <div className="rounded-xl border border-card-border bg-card p-0 shadow-[0_1px_2px_hsl(219_45%_20%/0.05)] md:px-5 md:py-2 max-md:border-0 max-md:bg-transparent max-md:shadow-none">
            <JobList jobs={q.data} backTo={here} />
          </div>
        )}
      </div>
    </div>
  );
}
