import type { EventItem } from '../../types';
import type { EventUiStatus } from '../../locale/strings';

/** Maps event lifecycle + KPIs into overview badge semantics. */
export function deriveEventUiStatus(
  event: EventItem | null,
  kpis?: { safe: number; needHelp: number; pending: number; total: number },
): EventUiStatus {
  if (!event) return 'monitoring';
  if (event.status === 'closed') return 'resolved';
  if (event.status === 'draft') return 'monitoring';
  if (kpis && kpis.total > 0) {
    const pendRatio = kpis.pending / kpis.total;
    if (kpis.needHelp > 0 || pendRatio >= 0.2) return 'escalated';
  }
  return 'active';
}
