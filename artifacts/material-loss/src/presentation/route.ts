/** A distinct document entry, never a workspace/role override. */
export function isPresentationPath(pathname: string, base = "/") {
  const prefix = `${base.replace(/\/$/, "")}/presentation`;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
