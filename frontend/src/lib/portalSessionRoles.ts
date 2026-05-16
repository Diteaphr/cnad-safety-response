import type { AppSurface, Role, UserCapabilities } from '../types';

const KNOWN: ReadonlySet<Role> = new Set(['employee', 'supervisor', 'admin']);

/** 將 API 任意 `roles` 轉成小寫並過濾成已知 Role，避免異常／大小寫導致邏輯失效。 */
export function sanitizedRolesFromApi(raw: unknown): Role[] {
  if (!Array.isArray(raw)) return [];
  const out: Role[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const norm = entry.trim().toLowerCase() as Role;
    if (KNOWN.has(norm)) out.push(norm);
  }
  return [...new Set(out)];
}

export function deriveUserCapabilities(rawRoles: unknown): UserCapabilities {
  const r = sanitizedRolesFromApi(rawRoles);
  return {
    canManage: r.includes('admin'),
    canViewTeam: r.includes('supervisor'),
    hasStaffPortal: r.includes('employee') || r.includes('supervisor'),
  };
}

/**
 * 僅無員工／主管身分的 pure admin → 進管理中心；否則主系統首頁。
 */
export function initialSurfaceFromRoles(rawRoles: unknown): AppSurface {
  const c = deriveUserCapabilities(rawRoles);
  return c.canManage && !c.hasStaffPortal ? 'adminCenter' : 'member';
}
