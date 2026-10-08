import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useGetWorkspace } from '@workspace/api-client-react';
import '@/lib/i18n';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Shell, useWorkspaceSwitch } from '@/components/shell';
import { useAuth } from '@workspace/replit-auth-web';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/bits';
import { errorCode, useErrorText } from '@/lib/format';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import Jobs from '@/pages/jobs';
import JobNew from '@/pages/job-new';
import JobDetail from '@/pages/job-detail';
import JobEdit from '@/pages/job-edit';
import Settings from '@/pages/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => {
        const s = (err as { status?: number })?.status;
        if (s && s >= 400 && s < 500) return false;
        return count < 2;
      },
    },
  },
});

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/jobs/new" component={JobNew} />
        <Route path="/jobs/:id/edit" component={JobEdit} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

/** Explicit recovery for an expired private session. No automatic redirect, so no loop. */
function SessionExpired() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { go, pending } = useWorkspaceSwitch();
  return (
    <div role="alert" className="space-y-3 rounded-md border border-rework/50 bg-rework/10 p-4 text-sm" data-testid="alert-session-expired">
      <p className="font-medium">{t('workspace.expired')}</p>
      <p className="text-xs text-muted-foreground">{t('workspace.loginLoses')}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => login()} data-testid="button-session-login">{t('workspace.login')}</Button>
        <Button variant="outline" disabled={pending} onClick={() => go('demo')} data-testid="button-session-demo">
          {pending ? t('workspace.switching') : t('workspace.switchDemo')}
        </Button>
      </div>
    </div>
  );
}

/** Waits for the workspace (which establishes the demo cookie) before rendering any page. */
function WorkspaceGate() {
  const { t } = useTranslation();
  const errText = useErrorText();
  const ws = useGetWorkspace({ query: { staleTime: 60_000, queryKey: ['/api/workspace'] } });
  if (ws.isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background" role="status" aria-label={t('workspace.loading')}>
        <div className="h-12 bg-sidebar" />
        <div className="mx-auto max-w-7xl space-y-3 px-3 pt-6 sm:px-5">
          <Skeleton className="h-8 w-60" />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
        <span className="sr-only">{t('workspace.loading')}</span>
      </div>
    );
  }
  const unauthorized = ws.isError && errorCode(ws.error) === 'UNAUTHORIZED';
  if (!ws.data) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-20">
        {unauthorized ? <SessionExpired /> : <ErrorState message={`${t('workspace.loadError')} ${errText(ws.error)}`} onRetry={() => void ws.refetch()} />}
      </div>
    );
  }
  // Keep pages mounted on a background 401 so in-progress drafts are not discarded.
  return (
    <Shell ws={ws.data}>
      {unauthorized && <div className="mb-4"><SessionExpired /></div>}
      <Router />
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <WorkspaceGate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
