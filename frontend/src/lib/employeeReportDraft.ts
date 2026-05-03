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
  try {
    const raw = window.localStorage.getItem(employeeReportDraftKey(userId, eventId));
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<StoredEmployeeDraft>;
    if (typeof j.comment !== 'string' || typeof j.location !== 'string' || typeof j.selectedNeedHelp !== 'boolean')
      return null;
    return {
      comment: j.comment,
      location: j.location,
      selectedNeedHelp: j.selectedNeedHelp,
      updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveEmployeeReportDraft(userId: string, eventId: string, draft: Omit<StoredEmployeeDraft, 'updatedAt'>): void {
  try {
    const payload: StoredEmployeeDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(employeeReportDraftKey(userId, eventId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearEmployeeReportDraft(userId: string, eventId: string): void {
  try {
    window.localStorage.removeItem(employeeReportDraftKey(userId, eventId));
  } catch {
    /* noop */
  }
}
