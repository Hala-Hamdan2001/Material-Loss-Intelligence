import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, ListChecks, PlusSquare, SlidersHorizontal, Languages, Database, LogIn, LogOut, ChevronDown, Lock, FlaskConical, Users, MonitorPlay } from 'lucide-react';
import { useSwitchWorkspace, useListWorkspaces, getGetWorkspaceQueryKey, getListWorkspacesQueryKey, type Workspace } from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { clearScopedData, hasDirtyDraft, useErrorText } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', key: 'dashboard', Icon: LayoutGrid },
  { href: '/jobs', key: 'jobs', Icon: ListChecks },
  { href: '/jobs/new', key: 'newJob', Icon: PlusSquare },
  { href: '/settings', key: 'settings', Icon: SlidersHorizontal },
] as const;

function isActive(loc: string, href: string) {
  if (href === '/') return loc === '/';
  if (href === '/jobs') return loc === '/jobs' || (loc.startsWith('/jobs/') && loc !== '/jobs/new');
  return loc === href;
}

export function useWorkspaceSwitch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const errText = useErrorText();
  const { t } = useTranslation();
  const { isAuthenticated, login } = useAuth();
  const sw = useSwitchWorkspace({
    mutation: {
      onSuccess: async (ws) => {
        // Keep the active workspace query/observer: clearing it leaves the
        // mounted gate subscribed to an orphan query until a page reload.
        await qc.cancelQueries();
        clearScopedData(qc);
        qc.setQueryData(getGetWorkspaceQueryKey(), ws);
        toast({ title: t('workspace.switched') });
      },
      onError: (e) => toast({ title: errText(e), variant: 'destructive' }),
    },
  });
  const go = (mode: 'demo' | 'private', workspaceId?: string) => {
    if (mode === 'private' && !isAuthenticated) {
      login();
      return;
    }
    if (hasDirtyDraft() && !window.confirm(t('roles.discard'))) return;
    sw.mutate({ data: workspaceId ? { mode, workspaceId } : { mode } });
  };
  return { go, pending: sw.isPending };
}

function LanguageButton({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('text-sidebar-foreground hover:bg-sidebar-accent', className)}
      onClick={() => void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
      aria-label={t('lang.label')}
      data-testid="button-language"
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span lang={i18n.language === 'ar' ? 'en' : 'ar'}>{t('lang.switchTo')}</span>
    </Button>
  );
}

function WorkspaceMenu({ ws }: { ws: Workspace }) {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, login, logout } = useAuth();
  const { go, pending } = useWorkspaceSwitch();
  const list = useListWorkspaces({ query: { enabled: isAuthenticated, queryKey: getListWorkspacesQueryKey(), refetchInterval: 15_000 } });
  const others = (list.data ?? []).filter((c) => c.id !== ws.id);
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id : '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} aria-label={ws.isDemo ? t('workspace.demo') : t('workspace.private')} className="max-w-full shrink-0 text-sidebar-foreground hover:bg-sidebar-accent" data-testid="button-workspace-menu">
          {ws.isDemo ? <FlaskConical className="h-4 w-4 text-rework" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
          <span className="hidden truncate sm:inline">{pending ? t('workspace.switching') : ws.isDemo ? t('workspace.demo') : t('workspace.private')}</span>
          <ChevronDown className="hidden h-3.5 w-3.5 opacity-70 sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {isAuthenticated ? t('workspace.signedInAs', { name }) : t('workspace.notSignedIn')}
        </DropdownMenuLabel>
        {ws.userId && (
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
            {t('roles.accountId')}: <span dir="ltr" className="select-all break-all font-mono text-foreground" data-testid="text-menu-account-id">{ws.userId}</span>
          </DropdownMenuLabel>
        )}
        {!ws.isDemo && (
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground" data-testid="text-menu-role">
            {t('roles.role')}: {t(`roles.${ws.role}`)}
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        {others.map((c) => (
          <DropdownMenuItem key={c.id} className="min-h-11 lg:min-h-8" onSelect={() => go('private', c.id)} data-testid={`menu-workspace-${c.id}`}>
            <Users className="h-4 w-4" aria-hidden />
            <span className="min-w-0 truncate font-mono text-xs" dir="ltr">{c.id}</span>
            <span className="ms-auto text-[11px] text-muted-foreground">{t(`roles.${c.role}`)}</span>
          </DropdownMenuItem>
        ))}
        {ws.isDemo ? (
          <DropdownMenuItem className="min-h-11 lg:min-h-8" onSelect={() => go('private')} data-testid="menu-switch-private">
            <Lock className="h-4 w-4" aria-hidden />
            {isAuthenticated ? t('workspace.switchPrivate') : t('workspace.loginNeeded')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="min-h-11 lg:min-h-8" onSelect={() => go('demo')} data-testid="menu-switch-demo">
            <Database className="h-4 w-4" aria-hidden />
            {t('workspace.switchDemo')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="min-h-11 lg:min-h-8">
          <a href={`${import.meta.env.BASE_URL}presentation`} target="_blank" rel="noopener" data-testid="link-presentation-mode">
            <MonitorPlay className="h-4 w-4" aria-hidden />
            {i18n.language === 'ar' ? 'وضع العرض التقديمي' : 'Presentation mode'}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isAuthenticated ? (
          <DropdownMenuItem className="min-h-11 lg:min-h-8" onSelect={() => logout()} data-testid="menu-logout">
            <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden />
            {t('workspace.logout')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="min-h-11 lg:min-h-8" onSelect={() => login()} data-testid="menu-login">
            <LogIn className="h-4 w-4 rtl:rotate-180" aria-hidden />
            {t('workspace.login')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Shell({ ws, children }: { ws: Workspace; children: ReactNode }) {
  const { t } = useTranslation();
  const [loc] = useLocation();
  const nav = ws.role === 'worker' ? NAV.filter((n) => n.key !== 'dashboard') : NAV;
  return (
    <div className="min-h-[100dvh] bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:p-2">
        {t('app.skip')}
      </a>
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-5">
          <Link href="/" className="flex min-w-0 items-center gap-2" data-testid="link-home">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-sidebar-primary/50 font-mono text-xs font-semibold text-sidebar-primary" aria-hidden>{t('common.kg')}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">{t('app.name')}</span>
              <span className="hidden text-[11px] leading-tight text-sidebar-foreground/70 sm:block">{t('app.tagline')}</span>
            </span>
          </Link>
          <nav aria-label={t('nav.menu')} className="ms-6 hidden items-center gap-1 lg:flex">
            {nav.map(({ href, key, Icon }) => (
              <Link
                key={href}
                href={href}
                data-testid={`link-nav-${key}`}
                aria-current={isActive(loc, href) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  isActive(loc, href) && 'bg-sidebar-accent text-sidebar-foreground shadow-[inset_0_-2px_0_hsl(var(--sidebar-primary))]',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(`nav.${key}`)}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex min-w-0 items-center gap-1">
            <LanguageButton />
            <WorkspaceMenu ws={ws} />
          </div>
        </div>
        {ws.isDemo && (
          <div className="border-t border-sidebar-border bg-rework/15 px-3 py-1 text-center text-[11px] font-medium text-sidebar-foreground" data-testid="banner-demo">
            {t('workspace.synthetic')}
          </div>
        )}
      </header>
      <main id="main" className="mx-auto max-w-7xl px-3 pb-24 pt-5 sm:px-5 lg:pb-10">
        {children}
      </main>
      <nav aria-label={t('nav.menu')} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card lg:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
        {nav.map(({ href, key, Icon }) => (
          <Link
            key={href}
            href={href}
            data-testid={`link-mobile-${key}`}
            aria-current={isActive(loc, href) ? 'page' : undefined}
            className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground', isActive(loc, href) && 'text-primary font-semibold')}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span className="truncate px-1">{t(`nav.${key}`)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
