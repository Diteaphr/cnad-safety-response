export type Role = 'employee' | 'supervisor' | 'admin';

/** UI 殼：主系統 vs 管理中心 */
export type AppSurface = 'member' | 'adminCenter';

export interface UserCapabilities {
  canManage: boolean;
  canViewTeam: boolean;
  /** 具員工或主管身分，可由管理中心返回主系統 */
  hasStaffPortal: boolean;
}

export type SafetyStatus = 'safe' | 'need_help' | 'pending';

export type NavKey =
  | 'member-home'
  | 'team-dashboard-home'
  | 'employee-event-detail'
  | 'supervisor-event-detail'
  | 'admin-dashboard'
  | 'admin-event-detail'
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
  /** 與 GET/PUT /api/users/me 對齊；預設 true */
  pushEmergencyEnabled?: boolean;
  pushReminderEnabled?: boolean;
  pushEscalationEnabled?: boolean;
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
  /** 對應後端 events.start_time（ISO）；未設定時可能為 null */
  startAt: string | null;
  /** 對應後端 events.created_at（ISO） */
  createdAt: string;
  /** 列表卡上顯示的部門／單位（如 R&D） */
  cardDepartment?: string;
  /** 列表卡上顯示的地點摘要 */
  venue?: string;
}

/** 列表排序：優先 start_time（startAt）降序，缺欄或同分再以 createdAt 降序。 */
export function compareEventsByStartThenCreatedDesc(a: EventItem, b: EventItem): number {
  const ta =
    a.startAt != null && a.startAt !== '' ? new Date(a.startAt).getTime() : null;
  const tb =
    b.startAt != null && b.startAt !== '' ? new Date(b.startAt).getTime() : null;
  if (ta != null && tb != null && tb !== ta) return tb - ta;
  if (ta != null && tb == null) return -1;
  if (ta == null && tb != null) return 1;
  if (ta != null && tb != null && tb === ta) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/** 管理中心事件列表列（前端由 users／responses 彙總） */
export type AdminEventListRow = {
  event: EventItem;
  total: number;
  safe: number;
  needHelp: number;
  pending: number;
  responseRate: number;
  reported: number;
  lastActivityAt: number;
};

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

