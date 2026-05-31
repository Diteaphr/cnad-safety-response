import type { EmployeeReportFields, PendingSubmission } from './memberTypes';

export const EMPTY_STACK_REPORT_FIELDS: EmployeeReportFields = {
  comment: '',
  location: '',
  attachment: null,
};

export function heroSublineText(
  hasReport: boolean,
  wantToUpdate: boolean,
  reportingFn: (name: string) => string,
  draftText: string,
  userName: string,
): string {
  if (hasReport && wantToUpdate) return draftText;
  if (hasReport) return '\u00a0';
  return reportingFn(userName);
}

export function safeWideButtonClass(dimmed: boolean): string {
  return dimmed ? 'employee-status-wide safe is-dimmed' : 'employee-status-wide safe';
}

export function safeRevisionButtonClass(pendingSubmission: PendingSubmission): string {
  const base = 'employee-status-revision-btn employee-status-revision-btn--safe';
  return pendingSubmission === 'safe' ? `${base} is-selected` : base;
}

export function needRevisionButtonClass(pendingSubmission: PendingSubmission): string {
  const base = 'employee-status-revision-btn employee-status-revision-btn--need';
  return pendingSubmission === 'need_help' ? `${base} is-selected` : base;
}
