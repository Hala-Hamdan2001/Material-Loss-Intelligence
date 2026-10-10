import { useGetReferenceData } from '@workspace/api-client-react';
import { markDraftDirty } from '@/lib/format';
import { JobFormCore, type JobFormProps } from '@/components/job-form-core';

export { emptyForm, formFromJob, type FormState } from '@/components/job-form-core';

export function JobForm(props: JobFormProps) {
  const ref = useGetReferenceData({ query: { staleTime: 60_000, queryKey: ['/api/reference-data'] } });
  return <JobFormCore {...props} referenceData={ref.data} onDirtyChange={(d) => markDraftDirty(d ? 1 : -1)} />;
}
