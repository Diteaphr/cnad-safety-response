export type Role = 'employee' | 'supervisor' | 'admin';

export type SafetyStatus = 'safe' | 'need_help' | 'pending';

export type NavKey =
  | 'employee-home'
  | 'employee-event-detail'
  | 'employee-history'
  | 'supervisor-dashboard'
  | 'supervisor-event-detail'
  | 'admin-dashboard'
  | 'admin-event-detail'
  | 'event-management'
  | 'user-management'
  | 'notifications'
  | 'notifications-event-detail'
  | 'profile';

export interface User {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  roles: Role[];
  pushEnabled: boolean;
  managerId?: string | null;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  type: 'Earthquake' | 'Typhoon' | 'Fire' | 'Other';
  description: string;
  targetDepartmentIds: string[];
  status: 'draft' | 'active' | 'closed';
  startAt: string;
}

export interface SafetyResponse {
  id: string;
  eventId: string;
  userId: string;
  status: Exclude<SafetyStatus, 'pending'>;
  location?: string;
  comment?: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  eventId: string;
  sentAt: string;
  sentByRole: Role;
  note: string;
}

export interface NotificationSummary {
  pushSent: number;
  pushFailed: number;
  smsFallbackSent: number;
  reminderHistory: NotificationRecord[];
}

export interface ToastState {
  tone: 'success' | 'warning' | 'danger' | 'info';
  message: string;
}

