import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useBackTarget } from '@/hooks/use-nav';
import { hasDirtyDraft } from '@/lib/format';
import { useGetWorkspace } from '@workspace/api-client-react';

/** Context-aware back link: returns to the validated source dashboard/list (query preserved), else all jobs. */
export function BackLink({ fallback = '/jobs' }: { fallback?: string }) {
  const { t } = useTranslation();
  const back = useBackTarget();
  const ws = useGetWorkspace();
  const href = back ?? fallback;
  const isDashboard = (href === '/' || href.startsWith('/?')) && ws.data?.role !== 'worker';
  const label = href === '/board' ? t('nav.board') : back === null ? t('detail.back') : isDashboard ? t('nav.backDashboard') : t('nav.backJobs');
  return (
    <Link
      href={href}
      onClick={e => { if (hasDirtyDraft() && !window.confirm(t('nav.leave'))) e.preventDefault(); }}
      className="group mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 -ms-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="link-back"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" aria-hidden />
      {label}
    </Link>
  );
}
