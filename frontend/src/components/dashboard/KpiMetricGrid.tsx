import { Users, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';

export type DashboardMetricTone = 'primary' | 'safe' | 'danger' | 'warning';

export type DashboardMetric = {
  id: string;
  label: string;
  value: string | number;
  tone: DashboardMetricTone;
};

const ICONS: Record<DashboardMetricTone, typeof Users> = {
  primary: Users,
  safe: ShieldCheck,
  danger: AlertTriangle,
  warning: Clock,
};

/** KPI strip driven by metric array (reference colored metric cards). */
export function KpiMetricGrid({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <div className="dash-kpi-grid">
      {metrics.map((m) => {
        const Icon = ICONS[m.tone];
        return (
          <article key={m.id} className={`dash-kpi-card dash-kpi-card--${m.tone}`}>
            <Icon className="dash-kpi-card-icon" size={22} strokeWidth={2} aria-hidden />
            <div>
              <p className="dash-kpi-card-label">{m.label}</p>
              <p className="dash-kpi-card-value">{m.value}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
