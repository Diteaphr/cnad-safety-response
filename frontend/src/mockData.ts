import type { Department, EventItem, NotificationSummary, Role, SafetyResponse, User } from './types';

export const departments: Department[] = [
  { id: 'd-rd', name: 'R&D', parentId: null },
  { id: 'd-hr', name: 'HR', parentId: null },
  { id: 'd-ops', name: 'Operations', parentId: null },
  { id: 'd-fac', name: 'Facilities', parentId: null },
  { id: 'd-plant-a', name: 'Plant A', parentId: 'd-ops' },
  { id: 'd-plant-a-line1', name: 'Plant A - Line 1', parentId: 'd-plant-a' },
  { id: 'd-plant-a-line2', name: 'Plant A - Line 2', parentId: 'd-plant-a' },
];

export const users: User[] = [
  { id: 'u-01', name: 'Maggie Pan', email: 'maggie.pan@company.com', departmentId: 'd-rd', roles: ['employee'], pushEnabled: true, managerId: 'u-02' },
  { id: 'u-02', name: 'Jeffery Liao', email: 'jeffery@company.com', departmentId: 'd-rd', roles: ['employee', 'supervisor'], pushEnabled: true, managerId: 'u-04' },
  { id: 'u-03', name: 'Kelly Lin', email: 'kelly@company.com', departmentId: 'd-hr', roles: ['supervisor'], pushEnabled: false, managerId: 'u-04' },
  { id: 'u-04', name: 'Admin User', email: 'admin@company.com', departmentId: 'd-ops', roles: ['admin'], pushEnabled: true, managerId: null },
  { id: 'u-05', name: 'David Wang', email: 'david@company.com', departmentId: 'd-rd', roles: ['employee'], pushEnabled: true, managerId: 'u-02' },
  { id: 'u-06', name: 'Annie Liu', email: 'annie@company.com', departmentId: 'd-hr', roles: ['employee'], pushEnabled: false, managerId: 'u-03' },
  { id: 'u-07', name: 'Victor Hsu', email: 'victor@company.com', departmentId: 'd-plant-a-line1', roles: ['employee'], pushEnabled: true, managerId: 'u-04' },
];

/** 進行中 3：地震（Maggie 已報平安）、颱風（Maggie 未回報）、消防演練（Maggie I need help） */
export const events: EventItem[] = [
  {
    id: 'e-001',
    title: 'Earthquake Safety Check',
    type: 'Earthquake',
    description: 'M5+ earthquake detected in northern region. Report your status now.',
    targetDepartmentIds: ['d-rd', 'd-hr', 'd-ops', 'd-fac'],
    status: 'active',
    startAt: '2026-05-01T15:00:00.000Z',
    cardDepartment: 'R&D',
    venue: 'Building A, 3rd Floor, Lab 2',
  },
  {
    id: 'e-004',
    title: 'Fire Drill Check',
    type: 'Fire',
    description: 'Scheduled fire evacuation drill.',
    targetDepartmentIds: ['d-rd', 'd-ops'],
    status: 'active',
    startAt: '2026-05-03T04:30:00.000Z',
    cardDepartment: 'Operations',
    venue: 'Building B, Production Floor',
  },
  {
    id: 'e-002',
    title: 'Typhoon Safety Check',
    type: 'Typhoon',
    description: 'Typhoon warning raised. Confirm current working location and safety.',
    targetDepartmentIds: ['d-rd', 'd-fac'],
    status: 'active',
    startAt: '2026-05-03T08:00:00.000Z',
    cardDepartment: 'Facilities',
    venue: 'All Buildings',
  },
  {
    id: 'e-003',
    title: 'Annual Evacuation Drill',
    type: 'Other',
    description: 'Company-wide evacuation drill concluded.',
    targetDepartmentIds: ['d-rd', 'd-hr', 'd-ops'],
    status: 'closed',
    startAt: '2026-03-15T06:30:00.000Z',
    cardDepartment: 'R&D',
    venue: 'Main Campus Assembly Point',
  },
  {
    id: 'e-007',
    title: 'Flood Response Check',
    type: 'Other',
    description: 'Heavy rainfall event — response window closed.',
    targetDepartmentIds: ['d-rd', 'd-ops', 'd-fac'],
    status: 'closed',
    startAt: '2026-04-20T07:45:00.000Z',
    cardDepartment: 'R&D',
    venue: 'Building C, Basement',
  },
];

export const responses: SafetyResponse[] = [
  {
    id: 'r-001',
    eventId: 'e-001',
    userId: 'u-01',
    status: 'safe',
    comment: "I'm safe. Minor shaking, everything is normal now.",
    location: 'Building A, 3rd Floor, Lab 2',
    attachmentName: 'damage_photo.jpg',
    attachmentSizeBytes: 523 * 1024,
    updatedAt: '2026-05-01T15:10:00.000Z',
  },
  {
    id: 'r-drill-maggie',
    eventId: 'e-004',
    userId: 'u-01',
    status: 'need_help',
    comment: 'Need guidance at assembly point.',
    updatedAt: '2026-05-03T04:33:00.000Z',
  },
  { id: 'r-002', eventId: 'e-001', userId: 'u-05', status: 'need_help', comment: 'Minor injury near stairs', updatedAt: '2026-05-01T15:04:00.000Z' },
  { id: 'r-003', eventId: 'e-001', userId: 'u-07', status: 'safe', comment: 'Plant A assembly point', updatedAt: '2026-05-01T15:05:00.000Z' },
  /* Maggie 對 e-003、e-007 為已結束事件之安全回報（供 Closed 列表展示） */
  { id: 'r-004', eventId: 'e-003', userId: 'u-01', status: 'safe', comment: 'Evacuated with team.', updatedAt: '2026-03-15T06:42:00.000Z' },
  { id: 'r-005-other', eventId: 'e-003', userId: 'u-05', status: 'safe', comment: 'No issue', updatedAt: '2026-03-15T06:41:00.000Z' },
  { id: 'r-flood-maggie', eventId: 'e-007', userId: 'u-01', status: 'safe', comment: 'Area cleared.', updatedAt: '2026-04-20T08:10:00.000Z' },
  { id: 'r-008', eventId: 'e-004', userId: 'u-05', status: 'safe', comment: 'Production floor evacuated', updatedAt: '2026-05-03T04:35:00.000Z' },
  /* e-002 颱風：其他同仁有回報，Maggie 刻意未回報以呈現 Pending */
  { id: 'r-009', eventId: 'e-002', userId: 'u-05', status: 'safe', comment: 'WFH safe', updatedAt: '2026-05-03T08:15:00.000Z' },
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
