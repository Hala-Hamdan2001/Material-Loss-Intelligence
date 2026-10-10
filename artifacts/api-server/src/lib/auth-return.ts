/** Only local absolute paths; browsers normalize backslashes and control bytes. */
export function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") ||
      value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  try {
    if (new URL(value, "https://local.invalid").origin !== "https://local.invalid") return "/";
    return value;
  } catch {
    return "/";
  }
}
