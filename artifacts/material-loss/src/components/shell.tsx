import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, ListChecks, PlusSquare, SlidersHorizontal, Languages, Database, LogIn, LogOut, ChevronsUpDown, Lock, FlaskConical, Users, Menu, Columns3 } from 'lucide-react';
import { useSwitchWorkspace, useListWorkspaces, getGetWorkspaceQueryKey, getListWorkspacesQueryKey, type Workspace } from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { clearScopedData, hasDirtyDraft, useErrorText } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

const NAV = [
  { href: '/', key: 'dashboard', Icon: LayoutGrid },
  { href: '/jobs', key: 'jobs', Icon: ListChecks },
  { href: '/board', key: 'board', Icon: Columns3 },
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
  const [, navigate] = useLocation();
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
        // Filters and job return paths belong to the old workspace as well.
        navigate('/', { replace: true });
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

type Variant = 'full' | 'rail' | 'bar';

function LanguageButton({ variant }: { variant: Variant }) {
  const { t, i18n } = useTranslation();
  const other = i18n.language === 'ar' ? 'en' : 'ar';
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar',
        variant === 'full' && 'w-full justify-start',
        variant === 'rail' && 'h-11 w-11 px-0',
      )}
      onClick={() => void i18n.changeLanguage(other)}
      aria-label={t('lang.label')}
      title={variant === 'rail' ? t('lang.label') : undefined}
      data-testid="button-language"
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span lang={other} className={cn(variant === 'rail' && 'sr-only')}>{t('lang.switchTo')}</span>
    </Button>
  );
}

function WorkspaceMenu({ ws, variant }: { ws: Workspace; variant: Variant }) {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, login, logout } = useAuth();
  const { go, pending } = useWorkspaceSwitch();
  const list = useListWorkspaces({ query: { enabled: isAuthenticated, queryKey: getListWorkspacesQueryKey(), refetchInterval: 15_000 } });
  const others = (list.data ?? []).filter((c) => c.id !== ws.id);
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id : '';
  const label = pending ? t('workspace.switching') : ws.isDemo ? t('workspace.demo') : t('workspace.private');
  const rtl = i18n.dir() === 'rtl';
  return (
    <DropdownMenu dir={rtl ? 'rtl' : 'ltr'}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={pending}
          aria-label={`${t('nav.workspace')}: ${label}`}
          title={variant === 'rail' ? label : undefined}
          className={cn(
            'text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar',
            variant === 'full' && 'h-auto w-full justify-start gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-start',
            variant === 'rail' && 'h-11 w-11 px-0',
            variant === 'bar' && 'h-11 px-2.5',
          )}
          data-testid="button-workspace-menu"
        >
          <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', ws.isDemo ? 'bg-rework/20 text-rework' : 'bg-sidebar-primary/15 text-sidebar-primary')} aria-hidden>
            {ws.isDemo ? <FlaskConical className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </span>
          {variant === 'full' && (
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/55">{t('nav.workspace')}</span>
              <span className="block truncate text-sm font-semibold">{label}</span>
              {!ws.isDemo && <span className="block truncate text-[11px] text-sidebar-foreground/60">{t(`roles.${ws.role}`)}</span>}
            </span>
          )}
          {variant === 'full' && <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === 'bar' ? 'end' : 'start'} side={variant === 'bar' ? 'bottom' : rtl ? 'left' : 'right'} sideOffset={8} className="w-64 rounded-xl">
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
        <DropdownMenuSeparator />
        {isAuthenticated ? (
          <DropdownMenuItem className="min-h-11 lg:min-h-8" onSelect={() => { if (hasDirtyDraft() && !window.confirm(t('nav.leave'))) return; logout(); }} data-testid="menu-logout">
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

/** Confirm before leaving a page with an unsaved job draft. */
function guardNav(e: MouseEvent, message: string) {
  if (hasDirtyDraft() && !window.confirm(message)) e.preventDefault();
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <Link href="/" onClick={(e) => guardNav(e, t('nav.leave'))} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" data-testid="link-home" aria-label={compact ? t('app.name') : undefined}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-mono text-[11px] font-bold text-sidebar-primary-foreground" aria-hidden>{t('common.kg')}</span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight text-sidebar-foreground">{t('app.name')}</span>
          <span className="block truncate text-[11px] leading-tight text-sidebar-foreground/60">{t('app.tagline')}</span>
        </span>
      )}
    </Link>
  );
}

type NavItem = (typeof NAV)[number];

function NavLinks({ items, loc, variant, onNavigate }: { items: readonly NavItem[]; loc: string; variant: Variant; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const prefix = variant === 'bar' ? 'link-mobile' : 'link-nav';
  return (
    <ul className={cn('flex flex-col', variant === 'rail' ? 'items-center gap-1.5' : 'gap-1')}>
      {items.map(({ href, key, Icon }) => {
        const active = isActive(loc, href);
        return (
          <li key={href} className={cn(variant === 'rail' ? '' : 'w-full')}>
            <Link
              href={href}
              data-testid={`${prefix}-${key}`}
              aria-current={active ? 'page' : undefined}
              title={variant === 'rail' ? t(`nav.${key}`) : undefined}
              onClick={(e) => { guardNav(e, t('nav.leave')); if (!e.defaultPrevented) onNavigate?.(); }}
              className={cn(
                'group relative flex items-center rounded-lg text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                variant === 'rail' ? 'h-14 w-14 flex-col justify-center gap-1 text-[10px]' : 'min-h-11 gap-3 px-3',
                active && 'bg-sidebar-accent text-sidebar-foreground',
              )}
            >
              <span aria-hidden className={cn('absolute inset-y-2 start-0 w-[3px] rounded-e-full bg-sidebar-primary transition-opacity', active ? 'opacity-100' : 'opacity-0', variant === 'rail' && '-start-2.5')} />
              <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground')} aria-hidden />
              <span className={cn(variant === 'rail' && 'max-w-full truncate px-0.5 leading-none')}>{t(`nav.${key}`)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DemoBanner() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 border-b border-rework/30 bg-rework/10 px-4 py-1.5 text-[12px] font-medium text-rework-ink" data-testid="banner-demo">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{t('workspace.synthetic')}</span>
    </div>
  );
}

export function Shell({ ws, children }: { ws: Workspace; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [loc] = useLocation();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const navTrigger = useRef<HTMLButtonElement>(null);
  const nav = ws.role === 'worker' ? NAV.filter((n) => n.key !== 'dashboard' && n.key !== 'board') : NAV;
  const rtl = i18n.dir() === 'rtl';

  // New page: start at the top (list pages restore their own remembered position afterwards).
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [loc]);
  useEffect(() => { setOpen(false); }, [loc]);
  // Warn on refresh/tab close with an unsaved draft.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (hasDirtyDraft()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow-lg">
        {t('app.skip')}
      </a>

      {!mobile && (
        <aside className="fixed inset-y-0 start-0 z-30 flex w-[84px] flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground lg:w-64" aria-label={t('nav.menu')}>
          <div className="flex h-16 items-center justify-center px-3 lg:justify-start lg:px-4">
            <div className="lg:hidden"><Brand compact /></div>
            <div className="hidden min-w-0 lg:block"><Brand /></div>
          </div>
          <nav aria-label={t('nav.menu')} className="flex-1 overflow-y-auto px-3 py-4">
            <div className="lg:hidden"><NavLinks items={nav} loc={loc} variant="rail" /></div>
            <div className="hidden lg:block"><NavLinks items={nav} loc={loc} variant="full" /></div>
          </nav>
          <div className="space-y-2 border-t border-sidebar-border p-3">
            <div className="flex flex-col items-center gap-1.5 lg:hidden">
              <LanguageButton variant="rail" />
              <WorkspaceMenu ws={ws} variant="rail" />
            </div>
            <div className="hidden space-y-2 lg:block">
              <LanguageButton variant="full" />
              <WorkspaceMenu ws={ws} variant="full" />
            </div>
          </div>
        </aside>
      )}

      {mobile && (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-sidebar px-2 text-sidebar-foreground shadow-[0_1px_0_hsl(var(--sidebar-border))]">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setOpen(true)}
            aria-label={t('nav.open')}
            aria-expanded={open}
            data-testid="button-open-nav"
            ref={navTrigger}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <div className="min-w-0 flex-1"><Brand /></div>
          <WorkspaceMenu ws={ws} variant="bar" />
        </header>
      )}

      {mobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent onCloseAutoFocus={e => { e.preventDefault(); navTrigger.current?.focus(); }} side={rtl ? 'right' : 'left'} dir={rtl ? 'rtl' : 'ltr'} className="flex w-[84vw] max-w-xs flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground [&>button]:end-3 [&>button]:start-auto">
            <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
            <SheetDescription className="sr-only">{t('app.tagline')}</SheetDescription>
            <div className="flex h-16 items-center px-4"><Brand /></div>
            <nav aria-label={t('nav.menu')} className="flex-1 overflow-y-auto px-3 py-3">
              <NavLinks items={nav} loc={loc} variant="bar" onNavigate={() => setOpen(false)} />
            </nav>
            <div className="border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <LanguageButton variant="full" />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="md:ps-[84px] lg:ps-64">
        {ws.isDemo && <DemoBanner />}
        <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 focus:outline-none sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
