import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Inbox, SearchX } from 'lucide-react';
import { useListJobs, useGetReferenceData, getGetReferenceDataQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Panel, ErrorState, EmptyState, LoadingBlock } from '@/components/bits';
import { JobList } from '@/components/job-list';
import { cleanParams, useErrorText, useFmt } from '@/lib/format';

const selectCls = 'mt-1 h-11 w-full rounded-md border border-input bg-card px-2 text-sm lg:h-9';

export default function Jobs() {
  const { t } = useTranslation();
  const f = useFmt();
  const errText = useErrorText();
  const ref = useGetReferenceData({ query: { staleTime: 60_000, queryKey: getGetReferenceDataQueryKey() } });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [machine, setMachine] = useState('');
  const [material, setMaterial] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const params = cleanParams({ search, from, to, machine, material, status });
  const q = useListJobs(params);
  const filtered = !!params;
  const clear = () => {
    setSearchInput(''); setSearch(''); setFrom(''); setTo(''); setMachine(''); setMaterial(''); setStatus('');
  };

  return (
    <div>
      <PageHeader
        title={t('jobs.title')}
        subtitle={t('jobs.subtitle')}
        actions={
          <Button asChild className="h-11 lg:h-9">
            <Link href="/jobs/new" data-testid="button-new-job">
              <Plus className="h-4 w-4" aria-hidden />
              {t('nav.newJob')}
            </Link>
          </Button>
        }
      />
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-2">
            <Label htmlFor="j-search" className="text-xs">{t("jobs.search")}</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="j-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t('jobs.search')} aria-label={t('jobs.search')} className="h-11 ps-8 lg:h-9" data-testid="input-search" />
            </div>
          </div>
          <div>
            <Label htmlFor="j-machine" className="text-xs">{t('jobs.machine')}</Label>
            <select id="j-machine" value={machine} onChange={(e) => setMachine(e.target.value)} className={selectCls} data-testid="select-machine">
              <option value="">{t('jobs.allMachines')}</option>
              {ref.data?.machines.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="j-material" className="text-xs">{t('jobs.material')}</Label>
            <select id="j-material" value={material} onChange={(e) => setMaterial(e.target.value)} className={selectCls} data-testid="select-material">
              <option value="">{t('jobs.allMaterials')}</option>
              {ref.data?.materials.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="j-status" className="text-xs">{t('jobs.status')}</Label>
            <select id="j-status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} data-testid="select-status">
              <option value="">{t('status.all')}</option>
              <option value="draft">{t('status.draft')}</option>
              <option value="closed">{t('status.closed')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 lg:grid-cols-1">
            <div>
              <Label htmlFor="j-from" className="text-xs">{t('common.from')}</Label>
              <Input id="j-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 lg:h-9" data-testid="input-from" />
            </div>
            <div>
              <Label htmlFor="j-to" className="text-xs">{t('common.to')}</Label>
              <Input id="j-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-11 lg:h-9" data-testid="input-to" />
            </div>
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
          <div className="rounded-md border border-card-border bg-card p-0 md:px-4 md:py-2 max-md:border-0 max-md:bg-transparent">
            <JobList jobs={q.data} />
          </div>
        )}
      </div>
    </div>
  );
}
