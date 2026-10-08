import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Lock } from 'lucide-react';
import { useGetWorkspace, useUpdateSettings, getGetWorkspaceQueryKey, type Workspace } from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Panel } from '@/components/bits';
import { useWorkspaceSwitch } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { errorCode, normalizeDigits, useErrorText, useFmt, useInvalidateBusiness } from '@/lib/format';

export default function Settings() {
  const ws = useGetWorkspace();
  if (!ws.data) return null;
  return <SettingsForm key={ws.data.id} ws={ws.data} />;
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

        <Panel title={t('settings.workspace')} desc={t('settings.workspaceDesc')}>
          <div className="flex items-center gap-2 text-sm">
            {ws.isDemo ? <FlaskConical className="h-4 w-4 text-rework-ink" aria-hidden /> : <Lock className="h-4 w-4 text-primary" aria-hidden />}
            <span className="text-muted-foreground">{t('settings.current')}:</span>
            <span className="font-medium" data-testid="text-workspace">{ws.isDemo ? t('workspace.demo') : t('workspace.private')}</span>
          </div>
          {ws.isDemo && <p className="mt-2 text-xs text-rework-ink">{t('workspace.synthetic')}</p>}
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
      </div>
    </div>
  );
}
