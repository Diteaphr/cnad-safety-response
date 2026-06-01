import type { PortalStrings } from '../locale/strings';
import type { Department, EventItem } from '../types';

const ZH_STATUS_SUFFIXES = ['（進行中）', '（已結案）', '（已結束）'] as const;
const EN_STATUS_SUFFIXES = ['(In progress)', '(Closed)', '(Resolved)'] as const;

function stripTrailingEnStatusSuffix(title: string): string {
  let result = title.trim();
  let removed = true;
  while (removed) {
    removed = false;
    const lower = result.toLowerCase();
    for (const suffix of EN_STATUS_SUFFIXES) {
      const marker = suffix.toLowerCase();
      if (!lower.endsWith(marker)) continue;
      result = result.slice(0, -suffix.length).trimEnd();
      removed = true;
      break;
    }
  }
  return result;
}

/** Remove redundant lifecycle suffixes often duplicated in titles. */
export function stripRedundantStatusFromTitle(title: string): string {
  let result = title;
  for (const suffix of ZH_STATUS_SUFFIXES) {
    result = result.split(suffix).join('');
  }
  return stripTrailingEnStatusSuffix(result);
}

/** Impact scope line aligned with admin event list (`AdminEventCenterPage`). */
export function formatEventImpactScope(
  ev: EventItem,
  departments: Department[],
  portalStrings: PortalStrings,
): string {
  const tids = ev.targetDepartmentIds ?? [];
  if (tids.length === 0) return portalStrings.adminScopeAllEmployees;
  if (ev.cardDepartment?.trim()) return ev.cardDepartment.trim();
  const names = tids
    .map((id) => departments.find((d) => d.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return '—';
  if (names.length <= 2) return names.join('、');
  return `${names[0]} · +${names.length - 1}`;
}

export function formatAdminEventTypeLabel(evType: string, portalStrings: PortalStrings): string {
  switch (evType) {
    case 'Earthquake':
      return portalStrings.eventTypeEarthquake;
    case 'Typhoon':
      return portalStrings.eventTypeTyphoon;
    case 'Fire':
      return portalStrings.eventTypeFire;
    case 'Other':
      return portalStrings.eventTypeOther;
    default:
      return evType;
  }
}
