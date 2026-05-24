/** Page title block — matches admin-event-center-header (team reports list style). */
export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="page-header admin-event-center-header">
      <h2 className="admin-event-center-title">{title}</h2>
      {subtitle ? <p className="muted-text admin-event-center-sub">{subtitle}</p> : null}
    </header>
  );
}
