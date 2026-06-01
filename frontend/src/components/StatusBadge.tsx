import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { SafetyStatus } from '../types';

function statusBadgeLabel(
  status: SafetyStatus,
  labels: ReturnType<typeof getStrings>['statusBadge'],
): string {
  if (status === 'safe') return labels.safe;
  if (status === 'need_help') return labels.needHelp;
  return labels.pending;
}

export function StatusBadge({ status }: Readonly<{ status: SafetyStatus }>) {
  const { locale } = useLocale();
  const b = getStrings(locale).statusBadge;
  const text = statusBadgeLabel(status, b);
  return <span className={`status-badge ${status}`}>{text}</span>;
}

