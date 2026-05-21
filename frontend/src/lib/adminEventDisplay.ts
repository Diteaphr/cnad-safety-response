import type { PortalStrings } from '../locale/strings';
import type { Department, EventItem } from '../types';

/** Remove redundant lifecycle suffixes often duplicated in titles. */
export function stripRedundantStatusFromTitle(title: string): string {
  return title
    .replace(/（進行中）|（已結案）|（已結束）/g, '')
    .replace(/\s*\(In progress\)\s*|\s*\(Closed\)\s*|\s*\(Resolved\)\s*/gi, '')
    .trim();
}

/** Impact scope line aligned with admin event list (`AdminEventCenterPage`). */
export function formatEventImpactScope(ev: EventItem, departments: Department[], p: PortalStrings): string {
  const tids = ev.targetDepartmentIds ?? [];
  if (tids.length === 0) return p.adminScopeAllEmployees;
  if (ev.cardDepartment?.trim()) return ev.cardDepartment.trim();
  const names = tids
    .map((id) => departments.find((d) => d.id === id)?.name)
    .filter(Boolean) as string[];
  if (names.length === 0) return '—';
  if (names.length <= 2) return names.join('、');
  return `${names[0]} · +${names.length - 1}`;
}

export function formatAdminEventTypeLabel(evType: string, p: PortalStrings): string {
  switch (evType) {
    case 'Earthquake':
      return p.eventTypeEarthquake;
    case 'Typhoon':
      return p.eventTypeTyphoon;
    case 'Fire':
      return p.eventTypeFire;
    case 'Other':
      return p.eventTypeOther;
    default:
      return evType;
  }
}
