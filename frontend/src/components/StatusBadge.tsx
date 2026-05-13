import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { SafetyStatus } from '../types';

export function StatusBadge({ status }: { status: SafetyStatus }) {
  const { locale } = useLocale();
  const b = getStrings(locale).statusBadge;
  const text = status === 'safe' ? b.safe : status === 'need_help' ? b.needHelp : b.pending;
  return <span className={`status-badge ${status}`}>{text}</span>;
}

