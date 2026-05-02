import { ChevronRight, Users } from 'lucide-react';
import type { Department, User } from '../types';
import { initialsFromName } from './utils';

export function DirectReportsListPage({
  directReports,
  departments,
  onBack,
  onSelectSubordinate,
}: {
  directReports: User[];
  departments: Department[];
  onBack: () => void;
  onSelectSubordinate: (userId: string) => void;
}) {
  const deptLabel = (id: string) => departments.find((d) => d.id === id)?.name ?? '';

  return (
    <section className="page-section employee-events-page profile-settings-page">
      <button type="button" className="btn ghost profile-settings-back" onClick={onBack}>
        ← Back to Profile
      </button>

      <header className="employee-events-hero">
        <div className="employee-events-hero-text">
          <h2 className="employee-events-title">
            <Users className="employee-events-title-icon" aria-hidden />
            Direct Reports
          </h2>
          <p className="employee-events-subtitle">
            {directReports.length} people reporting to you. Tap to view event reporting history.
          </p>
        </div>
      </header>

      <div className="employee-events-card-list">
        <article className="profile-settings-panel profile-settings-panel--flush">
          <div className="profile-settings-person-stack">
            {directReports.map((rep) => (
              <button
                type="button"
                key={rep.id}
                className="profile-settings-person-row profile-settings-person-row--action"
                onClick={() => onSelectSubordinate(rep.id)}
              >
                <span className="profile-settings-person-avatar" aria-hidden>
                  {initialsFromName(rep.name)}
                </span>
                <span className="profile-settings-person-meta">
                  <span className="profile-settings-person-name">{rep.name}</span>
                  <span className="profile-settings-person-sub">
                    {[rep.jobTitle, deptLabel(rep.departmentId)].filter(Boolean).join(' · ') || deptLabel(rep.departmentId)}
                  </span>
                </span>
                <ChevronRight className="profile-settings-chevron" size={18} aria-hidden />
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
