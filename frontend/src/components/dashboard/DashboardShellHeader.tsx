import type { ReactNode } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

/** Reusable supervisor/admin dashboard top bar — values driven by props. */
export function DashboardShellHeader({
  brandName,
  navActions,
  backLabel,
  onBack,
  lastSyncedFormatted,
  syncOk,
  showBack = true,
}: {
  brandName: string;
  navActions?: ReactNode;
  backLabel: string;
  onBack: () => void;
  lastSyncedFormatted: string | null;
  syncOk?: boolean;
  /** Team home list omits event back affordance — top bar stays for sync/branding only. */
  showBack?: boolean;
}) {
  return (
    <header className="dash-shell-header">
      <div className="dash-shell-header-brand">
        {showBack ? (
          <button type="button" className="dash-shell-back btn ghost" onClick={onBack} aria-label={backLabel} title={backLabel}>
            <ArrowLeft size={18} aria-hidden />
          </button>
        ) : (
          <span className="dash-shell-brand-mark" aria-hidden />
        )}
        <span className="dash-shell-brand-text">{brandName}</span>
      </div>
      <div className="dash-shell-header-actions">
        {navActions ?? null}
        {lastSyncedFormatted ? (
          <div className="dash-shell-sync" title={lastSyncedFormatted}>
            {syncOk ? <CheckCircle2 className="dash-shell-sync-icon" size={18} aria-hidden /> : null}
            <span className="dash-shell-sync-text">{lastSyncedFormatted}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
