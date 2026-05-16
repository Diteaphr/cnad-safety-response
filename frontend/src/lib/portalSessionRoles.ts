import type { Role } from '../types';

const KNOWN: ReadonlySet<Role> = new Set(['employee', 'supervisor', 'admin']);

/** 將 API 任意 `roles` 轉成小寫並過濾成已知 Role，避免異常／大小寫導致合併邏輯失效。 */
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

/**
 * 後端 JWT／User 身上的完整 roles；側邊欄與登入分流改由此檔縮減為「工作台」選項。
 * - 若同時為 employee + supervisor（無論是否另有 admin）：在入口只保留一個工作台代表 **`supervisor`**
 *   （含個人報平安與主管團隊報表／通知側欄），不並列員工／主管二選一。
 * - 若有 admin：在「工作台代表」之外再附上 **admin**，供使用者選進管理後台。
 */
export function memberRepresentativeRole(rawRoles: Role[]): Role | null {
  if (rawRoles.includes('supervisor')) return 'supervisor';
  if (rawRoles.includes('employee')) return 'employee';
  return null;
}

/** 側邊欄「切換身分」選項與登入後是否需進選角頁；順序：先工作台、後 admin。 */
export function portalSwitcherRoles(rawRoles: unknown): Role[] {
  const roles = sanitizedRolesFromApi(rawRoles);
  const member = memberRepresentativeRole(roles);
  const hasAdmin = roles.includes('admin');
  const out: Role[] = [];
  if (member) out.push(member);
  if (hasAdmin) out.push('admin');
  return out;
}
