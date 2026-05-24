import { ChevronRight } from 'lucide-react';
import { PageBackButton } from '../components/PageBackButton';
import { PageHeader } from '../components/PageHeader';
import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
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
  const { locale } = useLocale();
  const { profilePage: pp } = getStrings(locale);
  const deptLabel = (id: string) => departments.find((d) => d.id === id)?.name ?? '';

  return (
    <section className="page-section employee-events-page profile-settings-page">
      <PageBackButton onClick={onBack} ariaLabel={pp.backToProfile} />

      <PageHeader
        title={pp.directReports}
        subtitle={
          locale === 'zh-Hant'
            ? `您有 ${directReports.length} 位直屬部屬。點選以查看事件回報紀錄。`
            : `${directReports.length} people reporting to you. Tap to view event reporting history.`
        }
      />

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
