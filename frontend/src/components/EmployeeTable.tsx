import type { SafetyStatus } from '../types';
import { StatusBadge } from './StatusBadge';

export interface EmployeeRow {
  id: string;
  name: string;
  department: string;
  status: SafetyStatus;
  updatedAt?: string;
  note?: string;
  phone?: string;
  locationLine?: string;
}

export function EmployeeTable({ rows }: { rows: EmployeeRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Department</th>
            <th>Status</th>
            <th>Last Updated</th>
            <th>Location / Comment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.department}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>{row.updatedAt ? new Date(row.updatedAt).toLocaleTimeString() : '-'}</td>
              <td>
                {[
                  row.phone ? `電話 ${row.phone}` : null,
                  row.locationLine,
                  row.note,
                ]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

