import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Lock, Copy, Users } from 'lucide-react';
import {
  useGetWorkspace, useUpdateSettings, useListWorkspaces, useListMembers, useSaveMember,
  getGetWorkspaceQueryKey, getListWorkspacesQueryKey, getListMembersQueryKey, type Workspace, type Member, type MemberInputRole,
} from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Panel, LoadingBlock, ErrorState } from '@/components/bits';
import { useWorkspaceSwitch } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { errorCode, normalizeDigits, useErrorText, useFmt, useInvalidateBusiness } from '@/lib/format';

export default function Settings() {
  const ws = useGetWorkspace();
  if (!ws.data) return null;
  return <SettingsForm key={`${ws.data.id}|${ws.data.role}`} ws={ws.data} />;
}

function SettingsForm({ ws }: { ws: Workspace }) {
  const { t } = useTranslation();
  const f = useFmt();
  const qc = useQueryClient();
  const { toast } = useToast();
  const errText = useErrorText();
  const invalidate = useInvalidateBusiness();
  const { isAuthenticated, login, logout } = useAuth();
  const { go, pending: switching } = useWorkspaceSwitch();
  const [tol, setTol] = useState(String(ws.tolerance));
  const [thr, setThr] = useState(String(ws.highScrapThreshold));
  const [err, setErr] = useState<string | null>(null);
  const update = useUpdateSettings();

  const parse = (s: string, max: number) => {
    const n = normalizeDigits(s);
    if (!/^\d+(\.\d{0,3})?$/.test(n)) return null;
    const v = Number(n);
    return v >= 0 && v <= max ? v : null;
  };
  const tolV = parse(tol, 10);
  const thrV = parse(thr, 100);

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-2">
        {ws.role === 'worker' ? (
          <Panel title={t('settings.title')}>
            <p className="text-sm text-muted-foreground" data-testid="text-worker-limited">{t('roles.workerLimited')}</p>
          </Panel>
        ) : (
        <Panel title={t('settings.title')}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setErr(null);
              if (tolV === null || thrV === null) { setErr('settings.range'); return; }
              update.mutate(
                { data: { tolerance: tolV, highScrapThreshold: thrV } },
                {
                  onSuccess: (next) => {
                    qc.setQueryData(getGetWorkspaceQueryKey(), next);
                    void invalidate();
                    toast({ title: t('settings.saved') });
                  },
                  onError: (e2) => setErr(`errors.${errorCode(e2)}`),
                },
              );
            }}
          >
            <div>
              <Label htmlFor="s-tol">{t('settings.tolerance')}</Label>
              <div className="relative mt-1 max-w-48">
                <Input id="s-tol" inputMode="decimal" dir="ltr" value={tol} onChange={(e) => setTol(e.target.value)} className="h-11 pe-10 text-end font-mono lg:h-9" aria-invalid={tolV === null} data-testid="input-tolerance" />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">{t('common.kg')}</span>
              </div>
              <p className={`mt-1 text-xs ${tolV === null ? 'text-scrap' : 'text-muted-foreground'}`}>{tolV === null ? t('settings.range') : t('settings.toleranceHint')}</p>
            </div>
            <div>
              <Label htmlFor="s-thr">{t('settings.threshold')}</Label>
              <div className="relative mt-1 max-w-48">
                <Input id="s-thr" inputMode="decimal" dir="ltr" value={thr} onChange={(e) => setThr(e.target.value)} className="h-11 pe-10 text-end font-mono lg:h-9" aria-invalid={thrV === null} data-testid="input-threshold" />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">%</span>
              </div>
              <p className={`mt-1 text-xs ${thrV === null ? 'text-scrap' : 'text-muted-foreground'}`}>{thrV === null ? t('settings.range') : t('settings.thresholdHint')}</p>
            </div>
            <div>
              <div className="text-sm font-medium">{t('settings.baselineGap')}</div>
              <div className="tnum font-mono text-sm" data-testid="text-baseline-gap">{f.num(ws.baselineGap)}</div>
              <p className="text-xs text-muted-foreground">{t('settings.baselineGapHint')}</p>
            </div>
            {err && <p role="alert" className="rounded-sm bg-scrap/10 px-2 py-1.5 text-sm text-scrap">{t(err)}</p>}
            <Button type="submit" className="h-11 lg:h-9" disabled={update.isPending || tolV === null || thrV === null} data-testid="button-save-settings">
              {update.isPending ? t('form.saving') : t('common.save')}
            </Button>
          </form>
        </Panel>
        )}

        <Panel title={t('settings.workspace')} desc={t('settings.workspaceDesc')}>
          <div className="flex items-center gap-2 text-sm">
            {ws.isDemo ? <FlaskConical className="h-4 w-4 text-rework-ink" aria-hidden /> : <Lock className="h-4 w-4 text-primary" aria-hidden />}
            <span className="text-muted-foreground">{t('settings.current')}:</span>
            <span className="font-medium" data-testid="text-workspace">{ws.isDemo ? t('workspace.demo') : t('workspace.private')}</span>
          </div>
          {!ws.isDemo && (
            <div className="mt-1 text-sm"><span className="text-muted-foreground">{t('roles.role')}:</span> <span className="font-medium" data-testid="text-role">{t(`roles.${ws.role}`)}</span></div>
          )}
          {ws.isDemo && <p className="mt-2 text-xs text-rework-ink">{t('workspace.synthetic')}</p>}
          {ws.userId && <AccountId id={ws.userId} />}
          {isAuthenticated && <WorkspaceList current={ws.id} />}
          <div className="mt-4 flex flex-wrap gap-2">
            {ws.isDemo ? (
              <Button className="h-11 lg:h-9" disabled={switching} onClick={() => go('private')} data-testid="button-switch-private">
                {isAuthenticated ? t('workspace.switchPrivate') : t('workspace.loginNeeded')}
              </Button>
            ) : (
              <Button variant="outline" className="h-11 lg:h-9" disabled={switching} onClick={() => go('demo')} data-testid="button-switch-demo">
                {t('workspace.switchDemo')}
              </Button>
            )}
            {isAuthenticated ? (
              <Button variant="ghost" className="h-11 lg:h-9" onClick={() => logout()} data-testid="button-logout">{t('workspace.logout')}</Button>
            ) : (
              <Button variant="ghost" className="h-11 lg:h-9" onClick={() => login()} data-testid="button-login">{t('workspace.login')}</Button>
            )}
          </div>
        </Panel>
        {ws.role === 'manager' && <MembersPanel me={ws.userId} />}
      </div>
    </div>
  );
}

function AccountId({ id }: { id: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return (
    <div className="mt-4 rounded-md border border-border p-3">
      <div className="text-xs font-medium">{t('roles.accountId')}</div>
      <div className="mt-1 flex items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 select-all break-all font-mono text-sm" data-testid="text-account-id">{id}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void navigator.clipboard?.writeText(id).then(() => toast({ title: t('roles.copied') }))}
          data-testid="button-copy-account-id"
        >
          <Copy className="h-4 w-4" aria-hidden />
          {t('roles.copy')}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t('roles.accountIdHint')}</p>
    </div>
  );
}

function WorkspaceList({ current }: { current: string }) {
  const { t } = useTranslation();
  const { go, pending } = useWorkspaceSwitch();
  const list = useListWorkspaces({ query: { queryKey: getListWorkspacesQueryKey(), refetchInterval: 15_000 } });
  const items = list.data ?? [];
  return (
    <div className="mt-4">
      <div className="text-xs font-medium">{t('roles.workspaces')}</div>
      {list.isLoading ? (
        <LoadingBlock rows={2} />
      ) : items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('roles.noWorkspaces')}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border rounded-md border border-border">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm" data-testid={`row-workspace-${c.id}`}>
              <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-xs">{c.id}</span>
              <span className="text-xs text-muted-foreground">{t(`roles.${c.role}`)}</span>
              {c.id === current ? (
                <span className="text-xs font-medium text-primary">{t('roles.currentTag')}</span>
              ) : (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => go('private', c.id)} data-testid={`button-open-workspace-${c.id}`}>{t('roles.switchTo')}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MembersPanel({ me }: { me: string | null }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const invalidate = useInvalidateBusiness();
  const qc = useQueryClient();
  const members = useListMembers({ query: { queryKey: getListMembersQueryKey(), refetchInterval: 15_000 } });
  const save = useSaveMember();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<MemberInputRole>('worker');
  const [err, setErr] = useState<string | null>(null);

  const submit = (data: { userId: string; role: MemberInputRole; active: boolean }, reset?: boolean) => {
    setErr(null);
    save.mutate(
      { data },
      {
        onSuccess: () => {
          if (reset) setUserId('');
          void invalidate();
          void qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
          toast({ title: t('roles.memberSaved') });
        },
        onError: (e) => setErr(`errors.${errorCode(e)}`),
      },
    );
  };

  const row = (mb: Member) => (
    <li key={mb.userId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" data-testid={`row-member-${mb.userId}`}>
      <span dir="ltr" className="min-w-0 basis-full break-all font-mono text-xs sm:basis-auto sm:flex-1">{mb.userId}{mb.userId === me && <span className="font-sans text-muted-foreground"> ({t('roles.you')})</span>}</span>
      <span className="text-xs">{t(`roles.${mb.role}`)}</span>
      <span className={`text-xs ${mb.active ? 'text-good' : 'text-scrap'}`}>{mb.active ? t('roles.active') : t('roles.revoked')}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => submit({ userId: mb.userId, role: mb.role === 'manager' ? 'worker' : 'manager', active: mb.active })} data-testid={`button-role-${mb.userId}`}>
          {mb.role === 'manager' ? t('roles.makeWorker') : t('roles.makeManager')}
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => submit({ userId: mb.userId, role: mb.role, active: !mb.active })} data-testid={`button-active-${mb.userId}`}>
          {mb.active ? t('roles.revoke') : t('roles.restore')}
        </Button>
      </div>
    </li>
  );

  return (
    <Panel title={<span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" aria-hidden />{t('roles.members')}</span>} desc={t('roles.membersDesc')} testId="panel-members">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const id = userId.trim();
          if (!id) return;
          submit({ userId: id, role, active: true }, true);
        }}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="m-user" className="text-xs">{t('roles.userId')}</Label>
          <Input id="m-user" dir="ltr" maxLength={100} value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 h-11 font-mono lg:h-9" data-testid="input-member-id" />
        </div>
        <div>
          <Label htmlFor="m-role" className="text-xs">{t('roles.role')}</Label>
          <select id="m-role" value={role} onChange={(e) => setRole(e.target.value as MemberInputRole)} className="mt-1 h-11 rounded-md border border-input bg-card px-2 text-sm lg:h-9" data-testid="select-member-role">
            <option value="worker">{t('roles.worker')}</option>
            <option value="manager">{t('roles.manager')}</option>
          </select>
        </div>
        <Button type="submit" className="h-11 lg:h-9" disabled={save.isPending || !userId.trim()} data-testid="button-save-member">
          {save.isPending ? t('form.saving') : t('roles.add')}
        </Button>
      </form>
      {err && <p role="alert" className="mt-2 rounded-sm bg-scrap/10 px-2 py-1.5 text-sm text-scrap">{t(err)}</p>}
      <div className="mt-4">
        {members.isLoading ? (
          <LoadingBlock rows={3} />
        ) : members.isError ? (
          <ErrorState message={t('roles.membersError')} onRetry={() => void members.refetch()} />
        ) : (members.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('roles.noMembers')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">{(members.data ?? []).map(row)}</ul>
        )}
      </div>
    </Panel>
  );
}
