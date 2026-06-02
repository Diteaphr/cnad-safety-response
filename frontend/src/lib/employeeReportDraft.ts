import { portalLocalStorage } from './browserStorage';
import { nowUtcIso } from './localTime';

const PREFIX = 'cnad-employee-report-draft:v1';

export type StoredEmployeeDraft = {
  comment: string;
  location: string;
  selectedNeedHelp: boolean;
  updatedAt: string;
};

export function employeeReportDraftKey(userId: string, eventId: string): string {
  return `${PREFIX}:${userId}:${eventId}`;
}

export function loadEmployeeReportDraft(userId: string, eventId: string): StoredEmployeeDraft | null {
  const storage = portalLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(employeeReportDraftKey(userId, eventId));
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<StoredEmployeeDraft>;
    if (typeof j.comment !== 'string' || typeof j.location !== 'string' || typeof j.selectedNeedHelp !== 'boolean')
      return null;
    return {
      comment: j.comment,
      location: j.location,
      selectedNeedHelp: j.selectedNeedHelp,
      updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : nowUtcIso(),
    };
  } catch {
    return null;
  }
}

export function saveEmployeeReportDraft(userId: string, eventId: string, draft: Omit<StoredEmployeeDraft, 'updatedAt'>): void {
  const storage = portalLocalStorage();
  if (!storage) return;
  try {
    const payload: StoredEmployeeDraft = {
      ...draft,
      updatedAt: nowUtcIso(),
    };
    storage.setItem(employeeReportDraftKey(userId, eventId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearEmployeeReportDraft(userId: string, eventId: string): void {
  const storage = portalLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(employeeReportDraftKey(userId, eventId));
  } catch {
    /* noop */
  }
}
