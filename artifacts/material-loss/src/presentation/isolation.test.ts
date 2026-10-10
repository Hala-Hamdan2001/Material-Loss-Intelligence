import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { isPresentationPath } from "./route";
import { PRESENTATION_KEY, seedPresentation, loadPresentation, savePresentation } from "./store";
import { aggregate } from "@workspace/material-accounting";

const here = dirname(fileURLToPath(import.meta.url));
let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log(`PASS ${name}`); }
check("document entry selects only presentation paths, independent of identity", () => {
  for (const path of ["/presentation", "/presentation/", "/presentation/jobs/pres-001"]) assert.ok(isPresentationPath(path));
  for (const path of ["/", "/jobs", "/presentation-other", "/settings"]) assert.ok(!isPresentationPath(path));
  assert.ok(isPresentationPath("/app/presentation", "/app/"));
  assert.ok(!isPresentationPath("/presentation", "/app/"));
  const entry = readFileSync(resolve(here, "../main.tsx"), "utf8");
  assert.match(entry, /lazy\(\(\) => isPresentationPath/);
  assert.ok(!/import App from/.test(entry));
});
const values = new Map<string, string>([["private-sentinel", "untouched"]]);
const keys: string[] = [];
const storage = {
  getItem(key: string) { keys.push(key); return values.get(key) ?? null; },
  setItem(key: string, value: string) { keys.push(key); values.set(key,value); },
  removeItem(key: string) { keys.push(key); values.delete(key); },
};
check("seed creates only synthetic local records with unchanged accounting", () => {
  const a = seedPresentation(); const b = seedPresentation();
  a.jobs[0]!.reference = "changed";
  assert.equal(b.jobs[0]!.reference, "PRES-001");
  assert.ok(b.jobs.every(j => j.id.startsWith("pres-") && j.reference.startsWith("PRES-")));
  const totals = aggregate(b.jobs);
  assert.equal(totals.totalJobs,2); assert.equal(totals.issued,2200);
  assert.equal(totals.scrap,340); assert.equal(totals.good,1720);
});
check("local load/save/reset only access the presentation storage key", () => {
  assert.equal(loadPresentation(storage).issue,null);
  savePresentation(storage, {...seedPresentation(),view:"worker"});
  assert.equal(loadPresentation(storage).state.view,"worker");
  savePresentation(storage,seedPresentation());
  assert.equal(loadPresentation(storage).state.view,"manager");
  assert.equal(values.get("private-sentinel"),"untouched");
  assert.ok(keys.every(k => k === PRESENTATION_KEY));
});
check("invalid saved content is reported, not silently overwritten", () => {
  values.set(PRESENTATION_KEY, '{"version":999}');
  assert.equal(loadPresentation(storage).issue,"invalid");
  assert.equal(values.get(PRESENTATION_KEY),'{"version":999}');
  const broken = seedPresentation(); broken.jobs[0]!.good = 1;
  assert.throws(() => savePresentation(storage,broken));
});
check("unavailable storage is reported without a server fallback", () => {
  const denied = { ...storage, getItem() { throw new Error("Denied"); } };
  assert.equal(loadPresentation(denied).issue,"unavailable");
});

// Traverse *runtime* local imports, omitting type-only imports. This catches
// accidentally reconnecting presentation forms to the API-connected wrappers.
const configPath = resolve(here, "../../tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const {options} = ts.parseJsonConfigFileContent(config.config,ts.sys,dirname(configPath));
const visited = new Set<string>();
function inspect(path: string) {
  if (visited.has(path) || path.includes("/node_modules/") || path.endsWith(".d.ts")) return;
  visited.add(path);
  const source = readFileSync(path,"utf8");
  const emitted = ts.transpileModule(source,{compilerOptions:{...options,jsx:ts.JsxEmit.ReactJSX,verbatimModuleSyntax:false}}).outputText;
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|document\.cookie|@workspace\/api-client-react|@workspace\/replit-auth|\/api\//.test(emitted), `Network/auth dependency in ${path}`);
  const ast = ts.createSourceFile(path,emitted,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  function visit(node: ts.Node) {
    let specifier: string | undefined;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
    if (specifier) {
      const resolved = ts.resolveModuleName(specifier,path,options,ts.sys).resolvedModule?.resolvedFileName;
      if (resolved && existsSync(resolved)) inspect(resolved);
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);
}
check("presentation runtime graph contains no business API or authentication dependency", () => inspect(resolve(here,"PresentationApp.tsx")));
console.log(`${passed} isolation checks passed (${visited.size} local runtime modules inspected).`);
