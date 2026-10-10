import { useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useGetWorkspace, useGetJob, useUpdateJob, useCloseJob, getGetJobQueryKey, type JobInput } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { PageHeader, ErrorState, LoadingBlock, EmptyState } from '@/components/bits';
import { JobForm, formFromJob } from '@/components/job-form';
import { useToast } from '@/hooks/use-toast';
import { errorCode, useErrorText, useInvalidateBusiness, useFmt, hasDirtyDraft } from '@/lib/format';
import { Lock } from 'lucide-react';
import { useBackTarget } from '@/hooks/use-nav';
import { withBack } from '@/lib/nav';
import { BackLink } from '@/components/back-link';

export default function JobEdit() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const f = useFmt();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const errText = useErrorText();
  const invalidate = useInvalidateBusiness();
  const q = useGetJob(id, { query: { enabled: !!id, queryKey: getGetJobQueryKey(id), refetchOnWindowFocus: false } });
  const update = useUpdateJob();
  const close = useCloseJob();
  const ws = useGetWorkspace();
  const [serverError, setServerError] = useState<{ msg: string; stale: boolean } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const back = useBackTarget();
  const detailHref = (jid: string) => withBack(`/jobs/${jid}`, back);

  if (q.isLoading) return <LoadingBlock rows={8} />;
  if (q.isError || !q.data) {
    return errorCode(q.error) === 'NOT_FOUND' ? (
      <EmptyState icon={<Lock className="h-5 w-5" aria-hidden />} title={t('detail.notFound')} desc={t('detail.notFoundDesc')} action={<Button asChild variant="outline"><Link href={back ?? '/jobs'}>{t('detail.back')}</Link></Button>} />
    ) : (
      <ErrorState message={`${t('detail.error')} ${errText(q.error)}`} onRetry={() => void q.refetch()} />
    );
  }
  const job = q.data;
  if (job.status === 'closed') {
    return (
      <EmptyState
        icon={<Lock className="h-5 w-5" aria-hidden />}
        title={t('form.closedNotice')}
        action={<Button asChild><Link href={detailHref(job.id)} data-testid="link-to-job">{t('form.toJob')}</Link></Button>}
      />
    );
  }

  const onErr = (e: unknown) => setServerError({ msg: `errors.${errorCode(e)}`, stale: errorCode(e) === 'STALE_REVISION' });

  const onSubmit = (input: JobInput, andClose: boolean) => {
    setServerError(null);
    update.mutate(
      { id: job.id, data: { ...input, revision: job.revision } },
      {
        onSuccess: (saved) => {
          void invalidate();
          if (!andClose) {
            toast({ title: t('form.updated') });
            navigate(detailHref(saved.id));
            return;
          }
          close.mutate(
            { id: saved.id, data: { revision: saved.revision } },
            {
              onSuccess: () => {
                void invalidate();
                toast({ title: t('form.closed') });
                navigate(detailHref(saved.id));
              },
              onError: onErr,
            },
          );
        },
        onError: onErr,
      },
    );
  };

  return (
    <div>
      <BackLink />
      <PageHeader title={`${t('form.editTitle')} · ${job.reference}`} subtitle={t('form.editSubtitle', { revision: f.num(job.revision) })} />
      <JobForm
        key={`${job.id}-${formKey}`}
        initial={formFromJob(job)}
        tolerance={job.tolerance}
        pending={update.isPending || close.isPending}
        serverError={serverError ? t(serverError.msg) : undefined}
        serverErrorAction={
          serverError?.stale ? (
            <Button
              size="sm"
              variant="outline"
              data-testid="button-reload-latest"
              onClick={async () => {
                await q.refetch();
                setFormKey((k) => k + 1);
                setServerError(null);
              }}
            >
              {t('common.reload')}
            </Button>
          ) : null
        }
        onSubmit={onSubmit}
        onCancel={() => { if (!hasDirtyDraft() || window.confirm(t('nav.leave'))) navigate(detailHref(job.id)); }}
        allowClose={ws.data?.role !== 'worker'}
      />
    </div>
  );
}
