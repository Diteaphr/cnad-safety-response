import type { EmployeeReportFields, MemberMode } from '../features/member/memberScreens';
import {
  PORTAL_ACCESS_TOKEN_STORAGE_KEY,
  PORTAL_SURFACE_STORAGE_KEY,
} from '../api';
import type { AppSurface, NavKey, SafetyResponse } from '../types';

export const ADMIN_ONLY_NAV = new Set<NavKey>([
  'admin-dashboard',
  'admin-event-detail',
  'user-management',
]);

export const MEMBER_EXCLUSIVE_NAV = new Set<NavKey>([
  'member-home',
  'member-report-history',
  'team-dashboard-home',
  'supervisor-event-detail',
]);

/** 可切回員工／主管模式時，管理中心不顯示這些共用頁（改由主系統進入）。 */
export const STAFF_PORTAL_NAV = new Set<NavKey>([
  'notifications',
  'profile',
  'profile-direct-reports-list',
  'profile-direct-report-history',
]);

export function readPortalAccessToken(): string | null {
  try {
    const storage = globalThis.window?.localStorage;
    if (!storage) return null;
    return storage.getItem(PORTAL_ACCESS_TOKEN_STORAGE_KEY)?.trim() ?? null;
  } catch {
    return null;
  }
}

export function readStoredPortalSurface(): string | null {
  try {
    return globalThis.window?.localStorage?.getItem(PORTAL_SURFACE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writePortalSurface(surface: AppSurface): void {
  try {
    globalThis.window?.localStorage?.setItem(PORTAL_SURFACE_STORAGE_KEY, surface);
  } catch {
    /* ignore */
  }
}

export function resolveMemberHomeMode(hasDirectReports: boolean, hasManager: boolean): MemberMode {
  if (!hasDirectReports) return 1;
  if (hasManager) return 2;
  return 3;
}

export function latestResponseFor(
  responses: SafetyResponse[],
  eventId: string,
  userId: string,
): SafetyResponse | undefined {
  return responses
    .filter((r) => r.eventId === eventId && r.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

export function countTeamStatusForEvent(
  responses: SafetyResponse[],
  eventId: string,
  subordinateUserIds: string[],
): { safe: number; needHelp: number; pending: number; total: number } {
  let safe = 0;
  let needHelp = 0;
  let pending = 0;
  for (const sid of subordinateUserIds) {
    const lr = latestResponseFor(responses, eventId, sid);
    if (!lr) pending += 1;
    else if (lr.status === 'safe') safe += 1;
    else needHelp += 1;
  }
  return { safe, needHelp, pending, total: subordinateUserIds.length };
}

export function supervisorNudgeFromTeamCounts(
  team: { pending: number; total: number },
  eventTitle: string,
): { pendingPct: number; eventTitle: string } | null {
  if (team.pending <= 0 || team.total <= 0) return null;
  return {
    pendingPct: Math.round((team.pending / team.total) * 100),
    eventTitle,
  };
}

export function mergeReportsWithOptimistic(
  repFresh: SafetyResponse[],
  optimisticMap: Map<string, SafetyResponse>,
): SafetyResponse[] {
  if (optimisticMap.size === 0) return repFresh;
  const result = [...repFresh];
  for (const [key, optimistic] of optimisticMap) {
    const confirmed = repFresh.find(
      (r) =>
        r.eventId === optimistic.eventId &&
        r.userId === optimistic.userId &&
        new Date(r.updatedAt) >= new Date(optimistic.updatedAt),
    );
    if (confirmed) {
      optimisticMap.delete(key);
      continue;
    }
    const idx = result.findIndex(
      (r) => r.eventId === optimistic.eventId && r.userId === optimistic.userId,
    );
    if (idx >= 0) result[idx] = optimistic;
    else result.push(optimistic);
  }
  return result;
}

export function trimmedDashboardEventId(eid: string): string | undefined {
  const trimmed = eid.trim();
  return trimmed || undefined;
}

export function resolveDetailEventId(
  adminUi: boolean,
  supervisorUi: boolean,
  selectedAdminEventId: string | undefined,
  selectedSupervisorEventId: string | undefined,
): string {
  if (adminUi) return selectedAdminEventId ?? '';
  if (supervisorUi) return selectedSupervisorEventId ?? '';
  return '';
}

export function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

export function mergeUserResponseList(
  responses: SafetyResponse[],
  nextResponse: SafetyResponse,
): SafetyResponse[] {
  return [
    ...responses.filter(
      (r) => !(r.eventId === nextResponse.eventId && r.userId === nextResponse.userId),
    ),
    nextResponse,
  ];
}

export type SubmitReportMeta = { omitStoredAttachment?: boolean; showOverlay?: boolean };

export function buildLocalSafetyResponse(params: {
  eventId: string;
  userId: string;
  status: 'safe' | 'need_help';
  fields: EmployeeReportFields;
  prior?: SafetyResponse;
  keepPriorAttach: boolean;
}): SafetyResponse {
  const { eventId, userId, status, fields, prior, keepPriorAttach } = params;
  return {
    id: newLocalId('local'),
    eventId,
    userId,
    status,
    comment: fields.comment.trim() || undefined,
    location: fields.location.trim() || undefined,
    attachmentName:
      fields.attachment?.name ?? (keepPriorAttach ? prior?.attachmentName : undefined) ?? undefined,
    attachmentSizeBytes:
      fields.attachment?.size ?? (keepPriorAttach ? prior?.attachmentSizeBytes : undefined) ?? undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function enrichApiSafetyResponse(
  raw: SafetyResponse,
  fields: EmployeeReportFields,
  prior: SafetyResponse | undefined,
  keepPriorAttach: boolean,
): SafetyResponse {
  return {
    ...raw,
    attachmentName:
      fields.attachment?.name ?? (keepPriorAttach ? prior?.attachmentName : undefined) ?? raw.attachmentName,
    attachmentSizeBytes:
      fields.attachment?.size ??
      (keepPriorAttach ? prior?.attachmentSizeBytes : undefined) ??
      raw.attachmentSizeBytes,
  };
}

export function showForegroundPushNotification(title: string, body: string): void {
  if (Notification.permission !== 'granted') return;
  void navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').then((reg) => {
    reg?.showNotification(title, { body, icon: '/icon-192x192.png' });
  });
}

export function shouldOpenSubmissionOverlay(
  prior: SafetyResponse | undefined,
  meta?: SubmitReportMeta,
): boolean {
  return !prior || Boolean(meta?.showOverlay);
}

export function submissionSummaryFromResponse(
  status: 'safe' | 'need_help',
  nextResponse: SafetyResponse,
): import('../components/ReportSubmissionOverlay').ReportSubmissionSummary | undefined {
  if (status !== 'need_help') return undefined;
  return {
    location: nextResponse.location,
    comment: nextResponse.comment,
    attachmentName: nextResponse.attachmentName,
  };
}

export function navKeyAfterSurfaceGuard(
  surface: AppSurface,
  caps: { canViewTeam: boolean; hasStaffPortal: boolean },
  nk: NavKey,
): NavKey | null {
  if (surface === 'member' && ADMIN_ONLY_NAV.has(nk)) return 'member-home';
  if (surface === 'adminCenter' && MEMBER_EXCLUSIVE_NAV.has(nk)) return 'admin-dashboard';
  if (surface === 'adminCenter' && caps.hasStaffPortal && STAFF_PORTAL_NAV.has(nk)) {
    return 'admin-dashboard';
  }
  if (
    surface === 'member' &&
    !caps.canViewTeam &&
    (nk === 'team-dashboard-home' || nk === 'supervisor-event-detail')
  ) {
    return 'member-home';
  }
  return null;
}

export function resolveSupervisorTeamRowStatus(
  raw: string | undefined,
  latest: SafetyResponse | undefined,
  subTeamSummary: { safe: number; need_help: number; pending: number } | null | undefined,
  needsFollowUp: boolean | undefined,
): 'safe' | 'need_help' | 'pending' {
  if (raw === 'safe' || raw === 'need_help' || raw === 'pending') return raw;
  if (subTeamSummary) {
    if (subTeamSummary.need_help > 0) return 'need_help';
    if (subTeamSummary.pending > 0) return 'pending';
    return 'safe';
  }
  if (latest?.status === 'safe' || latest?.status === 'need_help') return latest.status;
  if (needsFollowUp === false) return 'safe';
  return 'pending';
}

export function applySupervisorNudgeAfterSubmit(params: {
  supervisorUi: boolean;
  subordinateUserIds: string[];
  mergedResponses: SafetyResponse[];
  eventId: string;
  eventTitle: string;
}): { pendingPct: number; eventTitle: string } | null {
  const { supervisorUi, subordinateUserIds, mergedResponses, eventId, eventTitle } = params;
  if (!supervisorUi || subordinateUserIds.length === 0) return null;
  const team = countTeamStatusForEvent(mergedResponses, eventId, subordinateUserIds);
  return supervisorNudgeFromTeamCounts(team, eventTitle);
}
