import { useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useCreateJob, useCloseJob, useGetWorkspace, type JobInput } from '@workspace/api-client-react';
import { PageHeader } from '@/components/bits';
import { JobForm, emptyForm } from '@/components/job-form';
import { useToast } from '@/hooks/use-toast';
import { errorCode, useErrorText, useInvalidateBusiness } from '@/lib/format';

export default function JobNew() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const errText = useErrorText();
  const invalidate = useInvalidateBusiness();
  const ws = useGetWorkspace();
  const [initial] = useState(emptyForm);
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateJob();
  const close = useCloseJob();

  const onSubmit = (input: JobInput, andClose: boolean) => {
    setServerError(null);
    create.mutate(
      { data: input },
      {
        onSuccess: (job) => {
          void invalidate();
          if (!andClose) {
            toast({ title: t('form.created') });
            navigate(`/jobs/${job.id}`);
            return;
          }
          close.mutate(
            { id: job.id, data: { revision: job.revision } },
            {
              onSuccess: () => {
                void invalidate();
                toast({ title: t('form.closed') });
                navigate(`/jobs/${job.id}`);
              },
              onError: (e) => {
                toast({ title: t('form.created'), description: errText(e), variant: 'destructive' });
                navigate(`/jobs/${job.id}/edit`);
              },
            },
          );
        },
        onError: (e) => setServerError(`errors.${errorCode(e)}`),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('form.newTitle')} subtitle={t('form.newSubtitle')} />
      <JobForm
        initial={initial}
        tolerance={ws.data?.tolerance ?? 0.1}
        pending={create.isPending || close.isPending}
        serverError={serverError ? t(serverError) : null}
        onSubmit={onSubmit}
        onCancel={() => navigate('/jobs')}
      />
    </div>
  );
}
