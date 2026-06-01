/** Safe browser storage access — aligns with `api.ts` portalLocalStorage pattern. */
export function portalLocalStorage(): Storage | null {
  try {
    return globalThis.window?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function portalSessionStorage(): Storage | null {
  try {
    return globalThis.window?.sessionStorage ?? null;
  } catch {
    return null;
  }
}
