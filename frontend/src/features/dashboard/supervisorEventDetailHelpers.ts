import type { DashboardStrings } from '../../locale/strings';

export function formatSupervisorViewScope(
  departmentFilter: string,
  departmentOptions: string[],
  dash: DashboardStrings,
): string {
  if (departmentFilter !== 'all') return departmentFilter;
  if (departmentOptions.length === 0) return '—';
  if (departmentOptions.length === 1) return departmentOptions[0]!;
  return dash.supervisorViewScopeAll(departmentOptions.join('、'));
}
