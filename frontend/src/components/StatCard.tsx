type StatCardProps = Readonly<{
  label: string;
  value: string | number;
  tone?: 'neutral' | 'safe' | 'danger' | 'warning' | 'primary';
  subLabel?: string;
}>;

export function StatCard({
  label,
  value,
  tone = 'neutral',
  subLabel,
}: StatCardProps) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {subLabel ? <span>{subLabel}</span> : null}
    </article>
  );
}

