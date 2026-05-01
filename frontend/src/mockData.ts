import type { Department, EventItem, NotificationSummary, Role, SafetyResponse, User } from './types';

export const departments: Department[] = [
  { id: 'd-rd', name: 'R&D', parentId: null },
  { id: 'd-hr', name: 'HR', parentId: null },
  { id: 'd-ops', name: 'Operations', parentId: null },
  { id: 'd-plant-a', name: 'Plant A', parentId: 'd-ops' },
  { id: 'd-plant-a-line1', name: 'Plant A - Line 1', parentId: 'd-plant-a' },
  { id: 'd-plant-a-line2', name: 'Plant A - Line 2', parentId: 'd-plant-a' },
];

export const users: User[] = [
  { id: 'u-01', name: 'Maggie Chen', email: 'maggie@company.com', departmentId: 'd-rd', roles: ['employee'], pushEnabled: true, managerId: 'u-02' },
  { id: 'u-02', name: 'Jeffery Liao', email: 'jeffery@company.com', departmentId: 'd-rd', roles: ['employee', 'supervisor'], pushEnabled: true, managerId: 'u-04' },
  { id: 'u-03', name: 'Kelly Lin', email: 'kelly@company.com', departmentId: 'd-hr', roles: ['supervisor'], pushEnabled: false, managerId: 'u-04' },
  { id: 'u-04', name: 'Admin User', email: 'admin@company.com', departmentId: 'd-ops', roles: ['admin'], pushEnabled: true, managerId: null },
  { id: 'u-05', name: 'David Wang', email: 'david@company.com', departmentId: 'd-rd', roles: ['employee'], pushEnabled: true, managerId: 'u-02' },
  { id: 'u-06', name: 'Annie Liu', email: 'annie@company.com', departmentId: 'd-hr', roles: ['employee'], pushEnabled: false, managerId: 'u-03' },
  { id: 'u-07', name: 'Victor Hsu', email: 'victor@company.com', departmentId: 'd-plant-a-line1', roles: ['employee'], pushEnabled: true, managerId: 'u-04' },
];

export const events: EventItem[] = [
  {
    id: 'e-001',
    title: 'Earthquake Safety Check',
    type: 'Earthquake',
    description: 'M5+ earthquake detected in northern region. Report your status now.',
    targetDepartmentIds: ['d-rd', 'd-hr', 'd-ops', 'd-plant-a'],
    status: 'active',
    startAt: '2026-05-01T15:00:00.000Z',
  },
  {
    id: 'e-002',
    title: 'Typhoon Office Safety Check',
    type: 'Typhoon',
    description: 'Typhoon warning raised. Confirm current working location and safety.',
    targetDepartmentIds: ['d-rd', 'd-ops'],
    status: 'active',
    startAt: '2026-05-02T03:00:00.000Z',
  },
  {
    id: 'e-003',
    title: 'Data Center Fire Incident',
    type: 'Fire',
    description: 'Fire suppression triggered. Confirm personnel safety.',
    targetDepartmentIds: ['d-ops'],
    status: 'closed',
    startAt: '2026-04-26T09:00:00.000Z',
  },
];

export const responses: SafetyResponse[] = [
  { id: 'r-001', eventId: 'e-001', userId: 'u-01', status: 'safe', comment: 'At office, all good', updatedAt: '2026-05-01T15:03:00.000Z' },
  { id: 'r-002', eventId: 'e-001', userId: 'u-05', status: 'need_help', comment: 'Minor injury near stairs', updatedAt: '2026-05-01T15:04:00.000Z' },
  { id: 'r-003', eventId: 'e-001', userId: 'u-07', status: 'safe', comment: 'Plant A assembly point', updatedAt: '2026-05-01T15:05:00.000Z' },
  { id: 'r-006', eventId: 'e-002', userId: 'u-01', status: 'safe', comment: 'Working from home', updatedAt: '2026-05-02T03:02:00.000Z' },
  { id: 'r-007', eventId: 'e-002', userId: 'u-05', status: 'safe', comment: 'Sheltered in office basement', updatedAt: '2026-05-02T03:04:00.000Z' },
  { id: 'r-004', eventId: 'e-003', userId: 'u-01', status: 'safe', comment: 'Left building safely', updatedAt: '2026-04-26T09:03:00.000Z' },
  { id: 'r-005', eventId: 'e-003', userId: 'u-05', status: 'safe', comment: 'No issue', updatedAt: '2026-04-26T09:05:00.000Z' },
];

export const notificationSummary: NotificationSummary = {
  pushSent: 1380,
  pushFailed: 32,
  smsFallbackSent: 29,
  reminderHistory: [
    { id: 'n-01', eventId: 'e-001', sentAt: '2026-05-01T15:10:00.000Z', sentByRole: 'supervisor', note: 'First reminder to non-responders' },
    { id: 'n-02', eventId: 'e-001', sentAt: '2026-05-01T15:20:00.000Z', sentByRole: 'admin', note: 'Escalation reminder sent' },
  ],
};

export const demoRoleAccounts: Array<{ id: string; label: string; roles: Role[]; userId: string }> = [
  { id: 'employee', label: 'Employee Demo', roles: ['employee'], userId: 'u-01' },
  { id: 'supervisor', label: 'Supervisor Demo', roles: ['supervisor'], userId: 'u-02' },
  { id: 'admin', label: 'Admin Demo', roles: ['admin'], userId: 'u-04' },
  { id: 'multi', label: 'Multi-role Demo', roles: ['employee', 'supervisor', 'admin'], userId: 'u-02' },
];

