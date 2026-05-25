export type DeptStatRow = {
  name: string;
  total: number;
  safe: number;
  needHelp: number;
  pending: number;
  responseRate: number;
};

type PersonRow = {
  department: string;
  status: 'safe' | 'need_help' | 'pending';
};

/** Aggregate employee rows by department; sort need-help depts first, then by response rate ascending. */
export function aggregateByDepartment(rows: PersonRow[]): DeptStatRow[] {
  const map = new Map<string, { safe: number; needHelp: number; pending: number }>();

  for (const row of rows) {
    const dept = row.department && row.department !== '-' && row.department.trim() !== '' ? row.department : '—';
    const bucket = map.get(dept) ?? { safe: 0, needHelp: 0, pending: 0 };
    if (row.status === 'safe') bucket.safe += 1;
    else if (row.status === 'need_help') bucket.needHelp += 1;
    else bucket.pending += 1;
    map.set(dept, bucket);
  }

  const result: DeptStatRow[] = [...map.entries()].map(([name, counts]) => {
    const total = counts.safe + counts.needHelp + counts.pending;
    const responseRate = total ? Math.round(((counts.safe + counts.needHelp) / total) * 100) : 0;
    return {
      name,
      total,
      safe: counts.safe,
      needHelp: counts.needHelp,
      pending: counts.pending,
      responseRate,
    };
  });

  result.sort((a, b) => {
    const aNeed = a.needHelp > 0 ? 0 : 1;
    const bNeed = b.needHelp > 0 ? 0 : 1;
    if (aNeed !== bNeed) return aNeed - bNeed;
    return a.responseRate - b.responseRate;
  });

  return result;
}
