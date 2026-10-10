import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/bits";
import { JobFormCore, emptyForm, formFromJob } from "@/components/job-form-core";
import "./copy";
import { loadPresentation, savePresentation, seedPresentation, TOLERANCE, type PresentationState, type StorageIssue } from "./store";
import { visibleJobs, saveDraft, closePresentationJob, reopenPresentationJob, addPresentationNote } from "./actions";
import { JobDetailView, JobTable, ManagerDashboard, useErrText } from "./views";

type Screen = { name: "home" } | { name: "detail"; id: string } | { name: "form"; id?: string };

export default function PresentationApp() {
  const { t, i18n } = useTranslation("presentation");
  const errText = useErrText();
  const [loaded] = useState(() => {
    try { return loadPresentation(window.sessionStorage); }
    catch { return { state: seedPresentation(), issue: "unavailable" as StorageIssue }; }
  });
  const [state, setState] = useState(loaded.state);
  const [issue, setIssue] = useState<StorageIssue | "error">(loaded.issue);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const dirty = useRef(false);
  const blocked = issue === "invalid";
  const memoryOnly = issue === "unavailable" || issue === "error";

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);
  useEffect(() => { document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr"; document.documentElement.lang = i18n.language; }, [i18n.language]);

  const okToLeave = () => !dirty.current || window.confirm(t("dirtyConfirm"));
  const go = (s: Screen) => { if (!okToLeave()) return false; dirty.current = false; setMsg(null); setScreen(s); return true; };
  const persist = (next: PresentationState) => {
    setState(next);
    if (issue === "unavailable") return;
    try { savePresentation(window.sessionStorage, next); setIssue(null); }
    catch { setIssue("error"); }
  };
  const run = (fn: () => PresentationState, ok: string, after?: (next: PresentationState) => void) => {
    if (blocked) { setMsg({ ok: false, text: t("blocked") }); return; }
    try { const next = fn(); persist(next); setMsg({ ok: true, text: t(ok) }); after?.(next); }
    catch (e) { setMsg({ ok: false, text: errText(e) }); }
  };

  const worker = state.view === "worker";
  const jobs = visibleJobs(state);
  const current = screen.name !== "home" && screen.id ? jobs.find(j => j.id === screen.id) : undefined;

  let body: React.ReactNode;
  if (screen.name === "form") {
    const editing = screen.id ? current : undefined;
    body = screen.id && !editing ? null : <div>
      <PageHeader title={editing ? <span className="font-mono">{editing.reference}</span> : t("newJob")} />
      <JobFormCore
        key={formKey}
        initial={editing ? formFromJob(editing) : emptyForm()}
        tolerance={editing?.tolerance ?? TOLERANCE}
        pending={blocked}
        referenceData={{
          products: [...new Set(jobs.map(j => j.product).filter(Boolean))],
          materials: [...new Set(jobs.map(j => j.material).filter(Boolean))],
          machines: [...new Set(jobs.map(j => j.machine).filter(Boolean))],
          scrapReasons: [...new Set(jobs.flatMap(j => j.scrapEntries.map(e => e.reason)).filter(Boolean))],
        }}
        allowClose={!worker}
        onDirtyChange={d => { dirty.current = d; }}
        onCancel={() => go(editing ? { name: "detail", id: editing.id } : { name: "home" })}
        onSubmit={(input, close) => run(() => {
          const before = new Set(state.jobs.map(j => j.id));
          let next = saveDraft(state, input, editing?.id);
          const id = editing?.id ?? next.jobs.find(j => !before.has(j.id))?.id;
          if (close && id) next = closePresentationJob(next, id);
          return next;
        }, close ? "closedOk" : "saved", next => {
          dirty.current = false;
          const id = editing?.id ?? next.jobs.find(j => !state.jobs.some(o => o.id === j.id))?.id;
          setScreen(id ? { name: "detail", id } : { name: "home" });
          setFormKey(k => k + 1);
        })}
      />
    </div>;
  } else if (screen.name === "detail" && current) {
    body = <JobDetailView job={current} all={jobs} worker={worker} blocked={blocked}
      onBack={() => go({ name: "home" })} onEdit={() => go({ name: "form", id: current.id })}
      onClose={() => run(() => closePresentationJob(state, current.id), "closedOk")}
      onReopen={r => run(() => reopenPresentationJob(state, current.id, r), "reopenedOk")}
      onNote={text => run(() => addPresentationNote(state, current.id, text), "noteOk")} />;
  } else if (worker) {
    body = <div className="space-y-4">
      <PageHeader title={t("workerJobs")} subtitle={t("workerDesc")} actions={<Button className="h-11 lg:h-9" disabled={blocked} onClick={() => go({ name: "form" })} data-testid="button-new-job"><Plus className="h-4 w-4" aria-hidden />{t("newJob")}</Button>} />
      <Panel title={t("jobs")}><JobTable jobs={jobs} onOpen={id => go({ name: "detail", id })} /></Panel>
    </div>;
  } else {
    body = <ManagerDashboard jobs={jobs} blocked={blocked} onNew={() => go({ name: "form" })} onOpen={id => go({ name: "detail", id })} />;
  }
  if (body === null) body = <Panel><p className="text-sm text-muted-foreground">{t("noJobs")}</p><Button variant="outline" className="mt-2" onClick={() => setScreen({ name: "home" })}>{t("back")}</Button></Panel>;

  return <div className="min-h-[100dvh] bg-background text-foreground">
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <h1 className="font-semibold">Material Loss Intelligence · {t("title")}</h1>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")} data-testid="button-language">{i18n.language === "ar" ? "English" : "العربية"}</Button>
          <Button variant="secondary" asChild><a href={import.meta.env.BASE_URL} onClick={e => { if (!okToLeave()) e.preventDefault(); else dirty.current = false; }} data-testid="link-exit">{t("exit")}</a></Button>
        </div>
      </div>
    </header>
    <div className="border-b border-rework/40 bg-rework/10 px-4 py-3 text-center text-sm" data-testid="presentation-banner">
      <p className="font-semibold">{t("banner")}</p><p>{t("privacy")}</p>
    </div>
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        {(["manager", "worker"] as const).map(view => <Button key={view} disabled={blocked} variant={state.view === view ? "default" : "outline"}
          onClick={() => { if (state.view !== view && go({ name: "home" })) persist({ ...state, view }); }} data-testid={`presentation-${view}`}>{t(view)}</Button>)}
        <Button variant="outline" className="ms-auto" onClick={() => {
          if (!window.confirm(t("resetConfirm"))) return;
          dirty.current = false; setScreen({ name: "home" }); setMsg(null); setFormKey(k => k + 1);
          const fresh = seedPresentation(); setState(fresh);
          if (issue === "unavailable") return;
          try { savePresentation(window.sessionStorage, fresh); setIssue(null); } catch { setIssue("unavailable"); }
        }} data-testid="presentation-reset">{t("reset")}</Button>
      </div>
      {issue && <p role="alert" className="rounded-md border border-rework p-3 text-sm" data-testid="text-storage-issue">{t(issue)}{blocked && ` ${t("blocked")}`}</p>}
      {msg && <p role="status" className={msg.ok ? "rounded-md bg-good/10 px-3 py-2 text-sm text-good" : "rounded-md bg-scrap/10 px-3 py-2 text-sm text-scrap"} data-testid="text-action-message">{msg.text}</p>}
      {body}
      <p className="text-xs text-muted-foreground">{memoryOnly ? t("unavailable") : t("local")}</p>
    </main>
  </div>;
}
