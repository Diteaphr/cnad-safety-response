export type Role = 'employee' | 'supervisor' | 'admin';

export type SafetyStatus = 'safe' | 'need_help' | 'pending';

export type NavKey =
  | 'member-home'
  | 'team-dashboard-home'
  | 'employee-event-detail'
  | 'supervisor-event-detail'
  | 'admin-dashboard'
  | 'admin-event-detail'
  | 'event-management'
  | 'user-management'
  | 'notifications'
  | 'profile'
  | 'profile-direct-reports-list'
  | 'profile-direct-report-history';

export interface User {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  roles: Role[];
  pushEnabled: boolean;
  managerId?: string | null;
  /** 員工編號（畫面顯示） */
  employeeCode?: string;
  /** 職稱 */
  jobTitle?: string;
  /** 電話／手機（選填） */
  phone?: string;
  /** Teams / 即時訊息 ID（選填） */
  teamsUsername?: string;
  /** 後端：缺少電話等必填聯絡資料時為 true，需先完成引導頁 */
  needsProfileCompletion?: boolean;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
}

/** GET /api/event-types — 對應資料庫 event_types 表（events.event_type_id） */
export interface EventTypeCatalogItem {
  id: string;
  code: string;
  name: string;
}

export interface EventItem {
  id: string;
  title: string;
  /** 內建為 Earthquake / Typhoon / Fire / Other，自訂類型為後端回傳的顯示名 */
  type: string;
  description: string;
  targetDepartmentIds: string[];
  status: 'active' | 'closed';
  startAt: string;
  /** 列表卡上顯示的部門／單位（如 R&D） */
  cardDepartment?: string;
  /** 列表卡上顯示的地點摘要 */
  venue?: string;
}

export interface SafetyResponse {
  id: string;
  eventId: string;
  userId: string;
  status: Exclude<SafetyStatus, 'pending'>;
  location?: string;
  comment?: string;
  /** 最近一次上傳的檔名（不重存 binary，仅展示用） */
  attachmentName?: string;
  attachmentSizeBytes?: number;
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

