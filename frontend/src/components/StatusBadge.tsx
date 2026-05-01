import type { SafetyStatus } from '../types';

export function StatusBadge({ status }: { status: SafetyStatus }) {
  return <span className={`status-badge ${status}`}>{label(status)}</span>;
}

function label(status: SafetyStatus) {
  if (status === 'safe') return 'Safe';
  if (status === 'need_help') return 'Need Help';
  return 'No Response';
}

