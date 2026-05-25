import { useState } from 'react';
import { Info } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import type { DashboardStrings } from '../../locale/strings';
import { initialsFromName } from '../../profile/utils';
import type { SafetyStatus, ToastState } from '../../types';
import { EmployeeContactDialog } from './EmployeeContactDialog';

export type SupervisorEmployeeRow = {
  id: string;
  name: string;
  department: string;
  status: SafetyStatus;
  phone?: string;
  email?: string;
  note?: string;
  locationLine?: string;
};

function stripeClass(status: SafetyStatus): string {
  if (status === 'safe') return 'safe';
  if (status === 'need_help') return 'need';
  return 'pending';
}

export function SupervisorEmployeeCardList({
  rows,
  dash,
  showToast,
}: {
  rows: SupervisorEmployeeRow[];
  dash: DashboardStrings;
  showToast: (t: ToastState) => void;
}) {
  const [contactRow, setContactRow] = useState<SupervisorEmployeeRow | null>(null);

  if (rows.length === 0) {
    return <p className="empty">{dash.noRows}</p>;
  }

  return (
    <>
      <div className="sv-employee-card-list">
        {rows.map((row) => (
          <article key={row.id} className={`sv-employee-card sv-employee-card--${stripeClass(row.status)}`}>
            <span className={`sv-employee-card-stripe sv-employee-card-stripe--${stripeClass(row.status)}`} aria-hidden />
            <span className="sv-employee-card-avatar" aria-hidden>
              {initialsFromName(row.name)}
            </span>
            <div className="sv-employee-card-body">
              <strong className="sv-employee-card-name">{row.name}</strong>
              <span className="sv-employee-card-dept">{row.department}</span>
            </div>
            <div className="sv-employee-card-aside">
              <StatusBadge status={row.status} />
              <button
                type="button"
                className="sv-employee-card-info-btn"
                aria-label={dash.supervisorContactTitle(row.name)}
                onClick={() => setContactRow(row)}
              >
                <Info size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </article>
        ))}
      </div>
      {contactRow ? (
        <EmployeeContactDialog
          name={contactRow.name}
          department={contactRow.department}
          phone={contactRow.phone}
          email={contactRow.email}
          note={contactRow.note}
          locationLine={contactRow.locationLine}
          open
          onClose={() => setContactRow(null)}
          dash={dash}
          showToast={showToast}
        />
      ) : null}
    </>
  );
}
