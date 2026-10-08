import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/bits';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<MapPinOff className="h-5 w-5" aria-hidden />}
      title={t('notFound.title')}
      desc={t('notFound.desc')}
      action={<Button asChild><Link href="/" data-testid="link-home-404">{t('notFound.home')}</Link></Button>}
    />
  );
}
