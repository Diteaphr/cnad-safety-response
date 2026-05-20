import type { AppLocale } from './LocaleContext';

export type EventUiStatus = 'active' | 'resolved' | 'monitoring' | 'escalated';

export type DashboardStrings = {
  brand: string;
  lastSynced: string;
  syncOk: string;
  backToEvents: string;
  supervisorTitle: string;
  supervisorSubtitle: string;
  adminTitle: string;
  adminSubtitle: string;
  teamHomeTitle: string;
  teamHomeSubtitle: string;
  ongoing: string;
  closed: string;
  eventOverviewTitle: string;
  eventDescriptionFallback: string;
  statusLabels: Record<EventUiStatus, string>;
  responseRateCenter: string;
  allAccountedTitle: string;
  allAccountedBody: (n: number, safe: number, help: number) => string;
  needHelpTitle: string;
  needHelpBody: (n: number) => string;
  pendingTitle: string;
  pendingBody: (n: number) => string;
  emptyTitle: string;
  emptyBody: string;
  footnoteAllSafe: string;
  footnotePending: string;
  distribution: string;
  immediateAttention: string;
  markContacted: string;
  contacted: string;
  pendingFollowUp: string;
  sendReminder: string;
  export: string;
  searchPlaceholder: string;
  filterAll: string;
  filterNeedHelp: string;
  filterPending: string;
  filterSafe: string;
  detailedList: string;
  noRows: string;
  globalOverview: string;
  deptRanking: string;
  deptRankingHint: string;
  deptFilterAll: string;
  criticalAlerts: string;
  noResponseQueue: string;
  mapPlaceholder: string;
  phoneLabel: string;
  noPhone: string;
  snapshotMismatchDetail: (serverTitle: string, selectedTitle: string) => string;
  teamActionsNote: string;
  highPendingWarn: string;
  allRespondedNote: string;
  manyUncontacted: (n: number) => string;
  kpiTotal: string;
  kpiSafe: string;
  kpiNeedHelp: string;
  kpiNoResponse: string;
  legendSafe: string;
  legendNeed: string;
  legendPending: string;
  /** Event overview card secondary timestamp line */
  asOf: string;
  employeeTableFootnote: (shown: number, total: number) => string;
  /** Explains the stacked bar under 回報分布 */
  distributionHint: string;
  /** Shorter hint when verbose copy is hidden (admin detail compact strip). */
  distributionCompactHint: string;
  /** a11y summary for the bar */
  distributionCaption: (
    safe: number,
    needHelp: number,
    pending: number,
    pctSafe: number,
    pctNeed: number,
    pctPending: number,
  ) => string;
  /** Admin event detail — tabs */
  tabOverview: string;
  tabTracking: string;
  tabDepartments: string;
  tabOverviewShort: string;
  tabTrackingShort: string;
  tabDepartmentsShort: string;
  /** Scope bar — admin event detail */
  adminScopeCurrentRangeHeading: string;
  adminScopeChipAllDepartments: string;
  adminScopeChipAllDepartmentsShort: string;
  adminScopeSelectDepartmentPlaceholder: string;
  adminScopeEmployeesOnlyHint: (deptName: string) => string;
  adminScopeEmployeesOnlyHintShort: string;
  /** Stats overview hero — aligns with admin event list progress language */
  adminDetailReportRateLine: (rate: number) => string;
  adminDetailCompletedRatio: (done: number, total: number) => string;
  /** Overview — department block title */
  adminDeptReportStatusTitle: string;
  adminDeptColDept: string;
  adminDeptColRate: string;
  adminDeptColSafe: string;
  adminDeptColNeed: string;
  adminDeptColPending: string;
  adminDeptActionView: string;
  /** Departments tab */
  adminDeptSituationHeading: string;
  adminDeptSituationSortHint: string;
  adminDeptPersonnelHeading: string;
  /** Tracking tab */
  trackingNeedHelpSection: string;
  trackingNeedHelpIntro: string;
  trackingPendingSection: string;
  trackingPendingIntro: string;
  trackingPendingEmptyTitle: string;
  trackingPendingEmptyBody: string;
  adminViewDetail: string;
  adminReportedAt: string;
  /** Close event flow */
  eventActionsTrigger: string;
  eventActionsAria: string;
  adminCloseEventOutlineLabel: string;
  adminCloseEventTitle: string;
  adminCloseEventOutstandingSummary: (needHelp: number, pending: number) => string;
  adminCloseEventNote: string;
  adminCloseEventAllDoneNote: string;
  adminCloseEventCancel: string;
  adminCloseEventConfirmAnyway: string;
  adminCloseEventConfirmOk: string;
};

export type ProfileStrings = {
  languageConfirmTitle: string;
  languageConfirmBody: (next: AppLocale) => string;
  confirm: string;
  cancel: string;
};

export type ProfilePageStrings = {
  pageTitle: string;
  pageSubtitle: string;
  personalSummary: string;
  personalSummaryDesc: string;
  rolesSection: string;
  rolesSectionDesc: string;
  notificationsSection: string;
  notificationsSectionDesc: string;
  prefsSection: string;
  prefsSectionDesc: string;
  languageLabel: string;
  timeZoneLabel: string;
  directManager: string;
  directReports: string;
  noManager: string;
  noReports: string;
  seeAll: string;
  pushMaster: string;
  pushMasterDesc: string;
  pushEmergency: string;
  pushEmergencyDesc: string;
  pushReminder: string;
  pushReminderDesc: string;
  pushEscalation: string;
  pushEscalationDesc: string;
  editProfile: string;
  changePassword: string;
  signOut: string;
  timezoneTaipei: string;
  timezoneUtc: string;
  toastEditSoon: string;
  toastPasswordSoon: string;
  toastPushOn: string;
  toastPushOff: string;
  roleEmployee: string;
  roleSupervisor: string;
  roleAdmin: string;
  /** Toast after language applied */
  languageApplied: string;
  onboardingTitle: string;
  onboardingSubtitle: string;
  onboardingNameLabel: string;
  onboardingPhoneLabel: string;
  onboardingPhonePlaceholder: string;
  onboardingNoSkip: string;
  onboardingContinue: string;
  onboardingPhoneRequired: string;
  onboardingSuccess: string;
  onboardingError: string;
  profileEditNameLabel: string;
  profileEditPhoneLabel: string;
  profileEditPhoneHint: string;
  profileSave: string;
  profileCancelEdit: string;
  profileUpdatedToast: string;
  profileSaveError: string;
};

export type EmployeeReportStrings = {
  submitting: string;
  submitFailTitle: string;
  retry: string;
  close: string;
  heroSublineReporting: (name: string) => string;
  heroSublineHasReport: string;
  heroSublineDraft: string;
  reportCardTitle: string;
  supplementaryTitle: string;
  optionalBadge: string;
  locationLabel: string;
  commentLabel: string;
  attachTitle: string;
  dropTitle: string;
  dropHint: string;
  removeAttachment: string;
  uploadTooBig: string;
  submitNeedHelp: string;
  backToEventsAria: string;
  noEventSelected: string;
  locationPlaceholder: string;
  commentPlaceholder: string;
  cardPendingLabel: string;
  cardReportedSafeLabel: string;
  cardReportedNeedLabel: string;
  cardAskSubmitHint: string;
  cardRespondedHint: (timeStr: string) => string;
  cardClosedBadge: string;
  cardIamSafeShort: string;
  cardNeedHelpShort: string;
  cardNoSubmissionClosed: string;
  cardContinue: string;
  cardViewLabel: string;
  reportSuccessTitle: string;
  statusDetailSafe: string;
  statusDetailNeedHelp: string;
  supplementOrUpdate: string;
  overlaySubmittedSafe: string;
  overlaySubmittedNeedHelp: string;
  supervisorNudgeTitle: string;
  supervisorNudgeBody: (eventTitle: string, pendingPct: number) => string;
  idleHeroTitle: string;
  idleHeroSubtitle: string;
  sectionOngoingEvents: string;
  sectionClosedEvents: string;
  idleNoOngoingSupplemented: string;
  idleNoClosedHistory: string;
  emergencyContactTitle: string;
  priorityStackAria: string;
  reportNowHeroTitle: string;
  reportNowHeroSubtitle: string;
  dualYourResponse: string;
  dualTeamOverview: (total: number) => string;
  dualAriaTeamSummary: string;
  dualPersonalSafeClosed: string;
  dualPersonalNeedClosed: string;
  dualNoPersonalSubmissionClosed: string;
  teamMiniSafe: (n: number) => string;
  teamMiniNeed: (n: number) => string;
  teamMiniPending: (n: number) => string;
  submittedAtLabel: string;
  editReport: string;
  done: string;
  revisionDetailsHeading: string;
  replaceAttachment: string;
  removeAttachmentAria: string;
};

export type StatusBadgeStrings = {
  safe: string;
  needHelp: string;
  pending: string;
};

export type LayoutNavStrings = {
  memberHome: string;
  teamReports: string;
  notifications: string;
  accountSettings: string;
  adminOverview: string;
  adminEvents: string;
  adminUsers: string;
  adminNotifications: string;
  adminSystemSettings: string;
};

export type LayoutChromeStrings = {
  offlineBanner: string;
  memberSidebarTitle: string;
  memberSidebarSub: string;
  adminSidebarTitle: string;
  adminSidebarSub: string;
  enterAdminCenter: string;
  backToStaffMode: string;
  logout: string;
  mobileAppTitle: string;
  /** 窄屏右上角：進入管理中心（可見標籤） */
  mobileEnterAdminCenter: string;
  /** 窄屏右上角：返回主系統（可見標籤） */
  mobileExitAdminCenter: string;
  ariaMobileEnterAdmin: string;
  ariaMobileExitAdmin: string;
};

/** Admin / supervisor portal pages (event pickers, management, notifications). */
export type PortalStrings = {
  adminGlobalEventCenter: string;
  notificationEventCenter: string;
  eventManagement: string;
  eventManagementIntro: string;
  userDeptManagement: string;
  employees: string;
  departmentHierarchy: string;
  managerSubordinatesHeading: string;
  deptIdLabel: (id: string) => string;
  pushEnabled: string;
  pushNotEnabled: string;
  unknownManager: string;
  backToEventList: string;
  notificationReminderCenter: string;
  deliverySummary: string;
  deliverySummaryIntro: string;
  pushSent: string;
  pushFailed: string;
  smsFallback: string;
  reminderActions: string;
  reminderActionsIntro: string;
  sendReminderToNonResponders: string;
  supervisorOnlyReminderTitle: string;
  reminderHistory: string;
  noReminderRecords: string;
  placeholderEventTitle: string;
  placeholderDescription: string;
  placeholderCustomType: string;
  datetimeLabel: string;
  createEventButton: string;
  activateButton: string;
  closeEventButton: string;
  formLabelEventType: string;
  formLabelNotifyTarget: string;
  notifyScopeAll: string;
  notifyScopeDepartments: string;
  notifyScopeDeptHint: string;
  formLabelCustomTypeDetail: string;
  eventTypeEarthquake: string;
  eventTypeTyphoon: string;
  eventTypeFire: string;
  eventTypeOther: string;
  eventLabelType: string;
  eventLabelStart: string;
  eventChipDraft: string;
  eventChipActive: string;
  eventChipClosed: string;
  noDescription: string;
  eventFilterLabel: string;
  filterAll: string;
  filterActive: string;
  filterDraft: string;
  filterClosed: string;
  failedDeliveries: string;
  failedDeliveriesHint: string;
  refreshFailedList: string;
  noFailedDeliveries: string;
  retryDelivery: string;
  failedReminderRetryOkToast: string;
  failedReminderRetryErrToast: string;
  failedReminderLoadErrToast: string;
  adminOnlyManageFailed: string;
  loading: string;
  na: string;
  notSentYet: string;
  notificationInboxTitle: string;
  notificationInboxIntro: string;
  notificationInboxEmpty: string;
  notificationInboxEventLabel: string;
  notificationInboxChannelLabel: string;
  notificationInboxStatusLabel: string;
  fabCreateEventAria: string;
  userMgmtAddAccount: string;
  userMgmtCreateSubmit: string;
  userMgmtNamePlaceholder: string;
  userMgmtEmailPlaceholder: string;
  userMgmtDeptLabel: string;
  userMgmtPhoneLabel: string;
  userMgmtPhonePlaceholder: string;
  userMgmtEmployeeNoLabel: string;
  userMgmtEmployeeNoPlaceholder: string;
  userMgmtDeptPickHint: string;
  userMgmtPhoneRequired: string;
  userMgmtEmployeeNoRequired: string;
  userMgmtTempPassword: (pw: string) => string;
  addEventTypeLink: string;
  addEventTypePlaceholder: string;
  addEventTypeSubmit: string;
  addEventTypeCancel: string;
  userMgmtEmployeesByDept: string;
  userMgmtEmployeesByDeptDesc: string;
  userMgmtEmployeeCount: (n: number) => string;
  userMgmtDeptRosterTitle: (deptName: string) => string;
  userMgmtBackToDepts: string;
  userMgmtNoEmployeesInDept: string;
  adminOverviewCreateTitle: string;
  adminOverviewCreateBody: string;
  adminOverviewCreateCta: string;
  adminCreateModalCancel: string;
  adminEventCenterSubtitle: string;
  adminEventCenterSearchPlaceholder: string;
  adminEventCenterReportProgress: string;
  adminEventCenterReportedOfTotal: (reported: number, total: number) => string;
  adminEventCenterStatusColumn: string;
  adminEventCenterLastUpdate: string;
  adminEventCenterTip: string;
  adminEventCenterTipDismissAria: string;
  adminEventCenterPageRange: (from: number, to: number, total: number) => string;
  adminEventCenterPerPage: string;
  adminScopeAllEmployees: string;
  adminEventCenterEmpty: string;
  adminEventCenterColEvent: string;
  adminEventCenterColStatus: string;
  adminEventCenterColProgress: string;
  adminEventCenterColStats: string;
  adminEventCenterColAction: string;
};

/** Copy for dashboards + profile confirmations (minimal i18n layer). */
export function getStrings(locale: AppLocale): {
  dash: DashboardStrings;
  profile: ProfileStrings;
  profilePage: ProfilePageStrings;
  layoutNav: LayoutNavStrings;
  layoutChrome: LayoutChromeStrings;
  employee: EmployeeReportStrings;
  statusBadge: StatusBadgeStrings;
  portal: PortalStrings;
} {
  return locale === 'en'
    ? {
        dash: dashEn,
        profile: profileEn,
        profilePage: profilePageEn,
        layoutNav: layoutNavEn,
        layoutChrome: layoutChromeEn,
        employee: employeeEn,
        statusBadge: statusBadgeEn,
        portal: portalEn,
      }
    : {
        dash: dashZh,
        profile: profileZh,
        profilePage: profilePageZh,
        layoutNav: layoutNavZh,
        layoutChrome: layoutChromeZh,
        employee: employeeZh,
        statusBadge: statusBadgeZh,
        portal: portalZh,
      };
}

const dashZh: DashboardStrings = {
  brand: 'Safety Connect',
  lastSynced: '上次同步',
  syncOk: '已連線',
  backToEvents: '返回事件列表',
  supervisorTitle: '主管儀表板',
  supervisorSubtitle: '目前事件的轄下回報總覽',
  adminTitle: '管理員儀表板',
  adminSubtitle: '全體目標員工回報總覽',
  teamHomeTitle: '團隊報表',
  teamHomeSubtitle: '進行中的事件列於最上方；點選卡片檢視轄下回報細節。',
  ongoing: '進行中',
  closed: '已結束',
  eventOverviewTitle: '目前事件',
  eventDescriptionFallback: '尚無事件說明。',
  statusLabels: {
    active: '進行中',
    resolved: '已結束',
    monitoring: '監看中',
    escalated: '升級關注',
  },
  responseRateCenter: '回報率',
  allAccountedTitle: '轄下皆已回報',
  allAccountedBody: (n, safe, help) =>
    `${n} 位轄下中，${safe} 位平安${help > 0 ? `，${help} 位需要協助` : '，無需協助'}。`,
  needHelpTitle: '需要立即關注',
  needHelpBody: (n) => `有 ${n} 位同仁標記為需要協助，請儘速聯繫。`,
  pendingTitle: '仍有未回報',
  pendingBody: (n) => `尚有 ${n} 位轄下未回報，請提醒確認安全狀態。`,
  emptyTitle: '尚無轄下資料',
  emptyBody: '此事件沒有可顯示的轄下名單。',
  footnoteAllSafe: '目前無需立即處置，所有已回報同仁均為平安。',
  footnotePending: '待辦：追蹤未回報同仁並視需要升級。',
  distribution: '回報分布',
  immediateAttention: '立即處理 · 需要協助',
  markContacted: '標記已聯繫',
  contacted: '已聯繫',
  pendingFollowUp: '待追蹤回報',
  sendReminder: '發送提醒',
  export: '匯出 / 寄信',
  searchPlaceholder: '搜尋同仁…',
  filterAll: '全部',
  filterNeedHelp: '需協助',
  filterPending: '未回報',
  filterSafe: '平安',
  detailedList: '同仁明細',
  noRows: '尚無符合的資料',
  globalOverview: '整體狀態',
  deptRanking: '部門回報排名',
  deptRankingHint: '點選部門可僅檢視該部門儀表與名單；再點「全部部門」恢復全公司視角。',
  deptFilterAll: '全部部門',
  criticalAlerts: '緊急名單',
  noResponseQueue: '未回報佇列',
  mapPlaceholder: '地圖／位置總覽（原型占位）',
  phoneLabel: '電話',
  noPhone: '無電話資料',
  snapshotMismatchDetail: (serverTitle, selectedTitle) =>
    `圖表中 KPI 為後端事件「${serverTitle}」；表格為您選取的「${selectedTitle}」。`,
  teamActionsNote: '請以電話或其他管道聯繫未回報同仁；本檢視不提供批次通知。',
  highPendingWarn: '逾三成部屬仍未回報，請優先聯繫並確認現況。',
  allRespondedNote: '所有部屬皆已送出狀態。',
  manyUncontacted: (n) => `仍有 ${n} 位需協助人員未完成聯繫確認。`,
  kpiTotal: '總人數',
  kpiSafe: '平安',
  kpiNeedHelp: '需協助',
  kpiNoResponse: '未回報',
  legendSafe: '平安',
  legendNeed: '需協助',
  legendPending: '未回報',
  asOf: '資料時間',
  employeeTableFootnote: (shown, total) => `顯示 ${shown} / ${total} 位`,
  distributionHint:
    '色塊長度＝各狀態人數占「總人數」的比例；下方列出人數與百分比（與上方圓餅右側數字一致）。',
  distributionCompactHint: '下方為各狀態人數與占比。',
  distributionCaption: (sf, nh, pd, ps, pn, pp) =>
    `平安 ${sf} 人（${ps}%）、需協助 ${nh} 人（${pn}%）、未回報 ${pd} 人（${pp}%）。`,
  tabOverview: '統計總覽',
  tabTracking: '追蹤中心',
  tabDepartments: '部門狀況',
  tabOverviewShort: '統計',
  tabTrackingShort: '追蹤',
  tabDepartmentsShort: '部門',
  adminScopeCurrentRangeHeading: '目前範圍',
  adminScopeChipAllDepartments: '全部部門',
  adminScopeChipAllDepartmentsShort: '全部',
  adminScopeSelectDepartmentPlaceholder: '選擇部門',
  adminScopeEmployeesOnlyHint: (deptName) => `僅顯示「${deptName}」員工資料`,
  adminScopeEmployeesOnlyHintShort: '僅顯示此部門資料',
  adminDetailReportRateLine: (rate) => `${rate}% 已回報`,
  adminDetailCompletedRatio: (done, total) => `${done} / ${total} 人已完成安全回報`,
  adminDeptReportStatusTitle: '部門狀況摘要',
  adminDeptColDept: '部門',
  adminDeptColRate: '回報率',
  adminDeptColSafe: '平安',
  adminDeptColNeed: '需協助',
  adminDeptColPending: '未回報',
  adminDeptActionView: '查看',
  adminDeptSituationHeading: '部門狀況',
  adminDeptSituationSortHint: '依未回報與需要協助人數排序',
  adminDeptPersonnelHeading: '人員狀態',
  trackingNeedHelpSection: '需要協助',
  trackingNeedHelpIntro: '已明確回報需要協助的人員，請優先追蹤。',
  trackingPendingSection: '未回報追蹤',
  trackingPendingIntro:
    '系統會依提醒規則自動通知未回報員工；以下為仍未完成回報的人員。',
  trackingPendingEmptyTitle: '未回報追蹤',
  trackingPendingEmptyBody:
    '目前沒有未回報人員。系統會依提醒規則自動通知未回報員工；若有人仍未完成回報，將會顯示於此。',
  adminViewDetail: '查看詳情',
  adminReportedAt: '回報時間',
  eventActionsTrigger: '事件操作',
  eventActionsAria: '事件操作選單',
  adminCloseEventOutlineLabel: '結束事件',
  adminCloseEventTitle: '結束事件？',
  adminCloseEventOutstandingSummary: (nh, pend) =>
    `目前仍有 ${nh} 人需要協助、${pend} 人尚未回報。`,
  adminCloseEventNote:
    '結束後，員工將無法再提交或修改此事件的安全回報；事件會移至已結束列表，管理員仍可查看統計與名單。',
  adminCloseEventAllDoneNote:
    '所有人員皆已完成回報且目前無人需要協助。結束後，此事件將移至已結束列表；員工將無法再提交或修改安全回報，管理員仍可查看統計與名單。',
  adminCloseEventCancel: '取消',
  adminCloseEventConfirmAnyway: '仍要結束事件',
  adminCloseEventConfirmOk: '確認結束',
};

const dashEn: DashboardStrings = {
  brand: 'Safety Connect',
  lastSynced: 'Last synced',
  syncOk: 'Live',
  backToEvents: 'Back to Events',
  supervisorTitle: 'Supervisor Dashboard',
  supervisorSubtitle: 'Overview of responses for the selected event',
  adminTitle: 'Admin Dashboard',
  adminSubtitle: 'Organization-wide response overview for the selected event',
  teamHomeTitle: 'Team dashboards',
  teamHomeSubtitle: 'Active events appear first; open a card to review team responses.',
  ongoing: 'Active',
  closed: 'Closed',
  eventOverviewTitle: 'Current event',
  eventDescriptionFallback: 'No description for this event.',
  statusLabels: {
    active: 'In progress',
    resolved: 'Resolved',
    monitoring: 'Monitoring',
    escalated: 'Escalated',
  },
  responseRateCenter: 'Response rate',
  allAccountedTitle: 'All employees accounted for',
  allAccountedBody: (n, safe, help) =>
    `${safe} of ${n} reported safe${help > 0 ? `; ${help} need help` : '; no assistance required'}.`,
  needHelpTitle: 'Immediate attention required',
  needHelpBody: (n) => `${n} employee(s) marked Need help — contact them now.`,
  pendingTitle: 'Missing responses',
  pendingBody: (n) => `${n} employee(s) have not reported yet.`,
  emptyTitle: 'No team data',
  emptyBody: 'There are no direct reports to show for this event.',
  footnoteAllSafe: 'No immediate action needed. Everyone who responded is safe.',
  footnotePending: 'Follow up on pending responders and escalate if needed.',
  distribution: 'Response distribution',
  immediateAttention: 'Immediate attention · Need help',
  markContacted: 'Mark contacted',
  contacted: 'Contacted',
  pendingFollowUp: 'Pending follow-up',
  sendReminder: 'Send reminder',
  export: 'Export / email',
  searchPlaceholder: 'Search employee…',
  filterAll: 'All',
  filterNeedHelp: 'Need help',
  filterPending: 'No response',
  filterSafe: 'Safe',
  detailedList: 'Employee list',
  noRows: 'No matching rows',
  globalOverview: 'Global status overview',
  deptRanking: 'Department ranking',
  deptRankingHint: 'Click a department to drill into that department’s dashboard and lists. Use “All departments” to reset.',
  deptFilterAll: 'All departments',
  criticalAlerts: 'Critical alerts',
  noResponseQueue: 'No-response queue',
  mapPlaceholder: 'Map / location overview (prototype)',
  phoneLabel: 'Phone',
  noPhone: 'No number on file',
  snapshotMismatchDetail: (serverTitle, selectedTitle) =>
    `Charts use server event "${serverTitle}"; tables follow your selection "${selectedTitle}".`,
  teamActionsNote: 'Contact pending employees directly; bulk notify is hidden in this view.',
  highPendingWarn: 'Over 30% of your team has not reported — prioritize outreach.',
  allRespondedNote: 'Everyone on your team has submitted a status.',
  manyUncontacted: (n) => `${n} need-help employees are not yet marked as contacted.`,
  kpiTotal: 'Total employees',
  kpiSafe: 'Safe',
  kpiNeedHelp: 'Need help',
  kpiNoResponse: 'No response',
  legendSafe: 'Safe',
  legendNeed: 'Need help',
  legendPending: 'No response',
  asOf: 'As of',
  employeeTableFootnote: (shown, total) => `Showing ${shown} of ${total} employees`,
  distributionHint:
    'Bar length is each status count as a share of total people in scope; numbers below match the KPI column.',
  distributionCompactHint: 'Counts and percentages by status are listed below.',
  distributionCaption: (sf, nh, pd, ps, pn, pp) =>
    `Safe ${sf} (${ps}%), need help ${nh} (${pn}%), no response ${pd} (${pp}%).`,
  tabOverview: 'Stats overview',
  tabTracking: 'Tracking center',
  tabDepartments: 'Departments',
  tabOverviewShort: 'Stats',
  tabTrackingShort: 'Track',
  tabDepartmentsShort: 'Depts',
  adminScopeCurrentRangeHeading: 'Current scope',
  adminScopeChipAllDepartments: 'All departments',
  adminScopeChipAllDepartmentsShort: 'All',
  adminScopeSelectDepartmentPlaceholder: 'Select department',
  adminScopeEmployeesOnlyHint: (deptName) => `Showing employees in “${deptName}” only`,
  adminScopeEmployeesOnlyHintShort: 'Showing this department only',
  adminDetailReportRateLine: (rate) => `${rate}% reported`,
  adminDetailCompletedRatio: (done, total) => `${done} / ${total} employees completed a safety report`,
  adminDeptReportStatusTitle: 'Department summary',
  adminDeptColDept: 'Department',
  adminDeptColRate: 'Rate',
  adminDeptColSafe: 'Safe',
  adminDeptColNeed: 'Need help',
  adminDeptColPending: 'Pending',
  adminDeptActionView: 'View',
  adminDeptSituationHeading: 'Department status',
  adminDeptSituationSortHint: 'Sorted by need-help and pending counts',
  adminDeptPersonnelHeading: 'Personnel status',
  trackingNeedHelpSection: 'Need help',
  trackingNeedHelpIntro: 'Employees who reported they need assistance — prioritize follow-up.',
  trackingPendingSection: 'Pending responses',
  trackingPendingIntro:
    'Automated reminders follow your notification rules; listed below are employees who still have not reported.',
  trackingPendingEmptyTitle: 'Pending responses',
  trackingPendingEmptyBody:
    'There are no pending responders right now. Reminders keep running automatically; anyone who still owes a report will appear here.',
  adminViewDetail: 'View details',
  adminReportedAt: 'Reported at',
  eventActionsTrigger: 'Event actions',
  eventActionsAria: 'Event actions menu',
  adminCloseEventOutlineLabel: 'Close event',
  adminCloseEventTitle: 'Close this event?',
  adminCloseEventOutstandingSummary: (nh, pend) =>
    `${nh} employee(s) still need assistance and ${pend} have not reported.`,
  adminCloseEventNote:
    'After closing, employees cannot submit or edit safety responses; the event moves to closed and admins can still view stats and rosters.',
  adminCloseEventAllDoneNote:
    'Everyone targeted has reported and no one currently needs assistance. Closing moves this event to the closed list; employees cannot submit or edit responses afterward, while admins can still review statistics.',
  adminCloseEventCancel: 'Cancel',
  adminCloseEventConfirmAnyway: 'Close anyway',
  adminCloseEventConfirmOk: 'Confirm close',
};

const profileZh: ProfileStrings = {
  languageConfirmTitle: '變更介面語言？',
  languageConfirmBody: (next) =>
    next === 'en'
      ? '確認後將立即切換為 English。'
      : '確認後將立即切換為繁體中文。',
  confirm: '確認',
  cancel: '取消',
};

const profileEn: ProfileStrings = {
  languageConfirmTitle: 'Switch interface language?',
  languageConfirmBody: (next) =>
    next === 'en'
      ? 'The app will switch to English immediately after you confirm.'
      : 'The app will switch to Traditional Chinese immediately after you confirm.',
  confirm: 'Confirm',
  cancel: 'Cancel',
};

const profilePageZh: ProfilePageStrings = {
  pageTitle: '個人資料與設定',
  pageSubtitle: '管理帳號、通知偏好與組織報告關係。',
  personalSummary: '個人摘要',
  personalSummaryDesc: '聯絡方式與部門資訊。',
  rolesSection: '角色與報告關係',
  rolesSectionDesc: '您在組織中的角色與上下線。',
  notificationsSection: '通知',
  notificationsSectionDesc: '選擇要接收的提醒類型。',
  prefsSection: '偏好與帳號',
  prefsSectionDesc: '語言、時區與密碼。',
  languageLabel: '語言',
  timeZoneLabel: '時區',
  directManager: '直屬主管',
  directReports: '直屬部屬',
  noManager: '目前沒有指定直屬主管。',
  noReports: '目前沒有直屬部屬。',
  seeAll: '查看所有',
  pushMaster: '推播總開關',
  pushMasterDesc: '接收重要警訊與系統更新。',
  pushEmergency: '緊急事件警報',
  pushEmergencyDesc: '新事件發布時通知。',
  pushReminder: '狀態提醒',
  pushReminderDesc: '提醒回報安全狀態。',
  pushEscalation: '升級／團隊更新',
  pushEscalationDesc: '追蹤待回應與升級流程。',
  editProfile: '編輯資料',
  changePassword: '變更密碼',
  signOut: '登出',
  timezoneTaipei: 'Asia／Taipei（UTC+08:00）',
  timezoneUtc: 'UTC',
  toastEditSoon: '編輯功能於正式版開放',
  toastPasswordSoon: '請聯繫 IT 或於正式版重設密碼',
  toastPushOn: '已開啟推播（原型）',
  toastPushOff: '已關閉推播（原型）',
  roleEmployee: '員工',
  roleSupervisor: '主管',
  roleAdmin: '管理員',
  languageApplied: '介面語言已更新。',
  onboardingTitle: '完成個人資料',
  onboardingSubtitle: '為了在緊急時能聯絡到您，請補齊以下資料。此步驟無法略過。',
  onboardingNameLabel: '姓名',
  onboardingPhoneLabel: '手機／電話',
  onboardingPhonePlaceholder: '例：+886912345678',
  onboardingNoSkip: '請填寫並儲存後才能進入系統。',
  onboardingContinue: '儲存並繼續',
  onboardingPhoneRequired: '請填寫電話或手機號碼。',
  onboardingSuccess: '已更新個人資料。',
  onboardingError: '無法儲存，請稍後再試。',
  profileEditNameLabel: '姓名',
  profileEditPhoneLabel: '手機／電話',
  profileEditPhoneHint: '用於緊急聯絡與簡訊備援；可留空。',
  profileSave: '儲存',
  profileCancelEdit: '取消',
  profileUpdatedToast: '個人資料已更新。',
  profileSaveError: '無法儲存，請稍後再試。',
};

const profilePageEn: ProfilePageStrings = {
  pageTitle: 'Profile & Settings',
  pageSubtitle: 'Account, notification preferences, and reporting relationships.',
  personalSummary: 'Summary',
  personalSummaryDesc: 'Contact details and department.',
  rolesSection: 'Role & reporting',
  rolesSectionDesc: 'Your role and reporting lines.',
  notificationsSection: 'Notifications',
  notificationsSectionDesc: 'Choose which alerts you receive.',
  prefsSection: 'Preferences & security',
  prefsSectionDesc: 'Language, time zone, and password.',
  languageLabel: 'Language',
  timeZoneLabel: 'Time zone',
  directManager: 'Manager',
  directReports: 'Direct reports',
  noManager: 'No manager assigned.',
  noReports: 'No direct reports.',
  seeAll: 'See all',
  pushMaster: 'Push master switch',
  pushMasterDesc: 'Receive critical alerts and product updates.',
  pushEmergency: 'Emergency alerts',
  pushEmergencyDesc: 'Notify when a new event is published.',
  pushReminder: 'Status reminders',
  pushReminderDesc: 'Remind you to report your safety status.',
  pushEscalation: 'Escalation & team updates',
  pushEscalationDesc: 'Track pending responses and escalations.',
  editProfile: 'Edit profile',
  changePassword: 'Change password',
  signOut: 'Sign out',
  timezoneTaipei: 'Asia/Taipei (UTC+08:00)',
  timezoneUtc: 'UTC',
  toastEditSoon: 'Profile editing ships in production.',
  toastPasswordSoon: 'Contact IT or use production reset flows.',
  toastPushOn: 'Push notifications on (prototype).',
  toastPushOff: 'Push notifications off (prototype).',
  roleEmployee: 'Employee',
  roleSupervisor: 'Supervisor',
  roleAdmin: 'Admin',
  languageApplied: 'Display language updated.',
  onboardingTitle: 'Complete your profile',
  onboardingSubtitle:
    'We need a reliable phone number to reach you during emergencies. This step cannot be skipped.',
  onboardingNameLabel: 'Name',
  onboardingPhoneLabel: 'Phone',
  onboardingPhonePlaceholder: 'e.g. +14155550100',
  onboardingNoSkip: 'Save your details to continue into the app.',
  onboardingContinue: 'Save and continue',
  onboardingPhoneRequired: 'Please enter a phone number.',
  onboardingSuccess: 'Profile updated.',
  onboardingError: 'Could not save. Please try again.',
  profileEditNameLabel: 'Name',
  profileEditPhoneLabel: 'Phone',
  profileEditPhoneHint: 'Used for emergencies and SMS fallback. You may leave this blank.',
  profileSave: 'Save',
  profileCancelEdit: 'Cancel',
  profileUpdatedToast: 'Profile saved.',
  profileSaveError: 'Could not save. Please try again.',
};

const layoutNavZh: LayoutNavStrings = {
  memberHome: '我的狀態',
  teamReports: '團隊回報',
  notifications: '通知',
  accountSettings: '帳號與設定',
  adminOverview: '總覽',
  adminEvents: '事件管理',
  adminUsers: '使用者',
  adminNotifications: '通知',
  adminSystemSettings: '系統設定',
};

const layoutNavEn: LayoutNavStrings = {
  memberHome: 'My status',
  teamReports: 'Team reports',
  notifications: 'Notifications',
  accountSettings: 'Account & settings',
  adminOverview: 'Overview',
  adminEvents: 'Events',
  adminUsers: 'Users',
  adminNotifications: 'Notifications',
  adminSystemSettings: 'System settings',
};

const layoutChromeZh: LayoutChromeStrings = {
  offlineBanner: '目前離線：已快取的資料仍可操作；請恢復連線後再試送出。',
  memberSidebarTitle: 'Safety Connect',
  memberSidebarSub: '緊急應變與個人回報',
  adminSidebarTitle: '管理中心',
  adminSidebarSub: '事件、派送與權限',
  enterAdminCenter: '管理中心',
  backToStaffMode: '返回主系統',
  logout: '登出',
  mobileAppTitle: 'Safety Connect',
  mobileEnterAdminCenter: '切換至管理中心',
  mobileExitAdminCenter: '返回主系統',
  ariaMobileEnterAdmin: '切換至管理中心視圖',
  ariaMobileExitAdmin: '離開管理中心，返回主系統／員工介面',
};

const layoutChromeEn: LayoutChromeStrings = {
  offlineBanner: "You're offline. Cached views still work — reconnect before submitting.",
  memberSidebarTitle: 'Safety Connect',
  memberSidebarSub: 'Emergency response',
  adminSidebarTitle: 'Admin Console',
  adminSidebarSub: 'Events, broadcasts & directory',
  enterAdminCenter: 'Admin Console',
  backToStaffMode: 'Back to main app',
  logout: 'Logout',
  mobileAppTitle: 'Safety Connect',
  mobileEnterAdminCenter: 'Admin center',
  mobileExitAdminCenter: 'Main app',
  ariaMobileEnterAdmin: 'Switch to admin console workspace',
  ariaMobileExitAdmin: 'Leave admin console and return to staff app',
};

const portalZh: PortalStrings = {
  adminGlobalEventCenter: '管理員 · 全域事件中心',
  notificationEventCenter: '通知／提醒事件中心',
  eventManagement: '事件管理',
  eventManagementIntro:
    '此頁僅列出事件；請於「總覽」按右下角 + 在彈出視窗建立新事件（建立後會帶您回到此列表）。',
  userDeptManagement: '使用者與部門管理',
  employees: '員工',
  departmentHierarchy: '部門階層',
  managerSubordinatesHeading: '主管 → 直屬部屬',
  deptIdLabel: (id) => `部門編號：${id}`,
  pushEnabled: '已開啟推播',
  pushNotEnabled: '未開啟推播',
  unknownManager: '不明主管',
  backToEventList: '← 返回事件列表',
  notificationReminderCenter: '通知與提醒中心',
  deliverySummary: '派送摘要',
  deliverySummaryIntro: '以下為此事件推播／提醒相關摘要（含本機紀錄之提醒批次與目前帳號可見之通知）。',
  pushSent: '推播成功',
  pushFailed: '推播失敗',
  smsFallback: '簡訊備援',
  reminderActions: '提醒動作',
  reminderActionsIntro: '對尚未回報的直屬員工發送後端提醒（僅主管角色可用）。',
  sendReminderToNonResponders: '向未回報者發送提醒',
  supervisorOnlyReminderTitle: '僅主管角色可送出提醒',
  reminderHistory: '提醒紀錄',
  noReminderRecords: '尚無提醒紀錄',
  placeholderEventTitle: '事件標題',
  placeholderDescription: '事件說明',
  placeholderCustomType: '自訂類型（例如：化學洩漏）',
  datetimeLabel: '開始時間',
  createEventButton: '建立事件',
  activateButton: '啟用',
  closeEventButton: '結束',
  formLabelEventType: '事件類型',
  formLabelNotifyTarget: '通知對象',
  notifyScopeAll: '全體員工',
  notifyScopeDepartments: '限定部門',
  notifyScopeDeptHint: '已選部門之子部門員工亦會收到通知。',
  formLabelCustomTypeDetail: '自訂類型說明',
  eventTypeEarthquake: '地震',
  eventTypeTyphoon: '颱風',
  eventTypeFire: '火災',
  eventTypeOther: '其他',
  eventLabelType: '類型',
  eventLabelStart: '開始',
  eventChipDraft: '草稿',
  eventChipActive: '進行中',
  eventChipClosed: '已結束',
  noDescription: '（無說明）',
  eventFilterLabel: '事件狀態篩選',
  filterAll: '全部',
  filterActive: '進行中',
  filterDraft: '草稿',
  filterClosed: '已結束',
  failedDeliveries: '推播失敗清單',
  failedDeliveriesHint: '列出此事件推播失敗的對象，方便重送與追蹤。',
  refreshFailedList: '重新整理失敗清單',
  noFailedDeliveries: '目前沒有推播失敗紀錄。',
  retryDelivery: '重送',
  failedReminderRetryOkToast: '已送出重試，狀態稍後會更新。',
  failedReminderRetryErrToast: '重試失敗，請稍後再試。',
  failedReminderLoadErrToast: '無法載入推播失敗清單。',
  adminOnlyManageFailed: '僅管理員可處理',
  loading: '載入中…',
  na: '未填',
  notSentYet: '尚未成功送達',
  notificationInboxTitle: '通知收件匣',
  notificationInboxIntro: '您收到的推播／簡訊紀錄（唯讀）。',
  notificationInboxEmpty: '尚無通知紀錄。',
  notificationInboxEventLabel: '事件',
  notificationInboxChannelLabel: '管道',
  notificationInboxStatusLabel: '狀態',
  fabCreateEventAria: '建立事件',
  userMgmtAddAccount: '新增帳號',
  userMgmtCreateSubmit: '建立帳號',
  userMgmtNamePlaceholder: '姓名',
  userMgmtEmailPlaceholder: 'Email',
  userMgmtDeptLabel: '部門',
  userMgmtPhoneLabel: '手機／電話',
  userMgmtPhonePlaceholder: '例：+886912345678',
  userMgmtEmployeeNoLabel: '員工編號',
  userMgmtEmployeeNoPlaceholder: '例：EMP2024001',
  userMgmtDeptPickHint: '點選一個部門（可依階層瀏覽）。',
  userMgmtPhoneRequired: '請填寫電話或手機號碼。',
  userMgmtEmployeeNoRequired: '請填寫員工編號。',
  userMgmtTempPassword: (pw) => `系統已產生暫時密碼（請轉交使用者並請其登入後變更）：${pw}`,
  addEventTypeLink: '＋ 新增事件類型',
  addEventTypePlaceholder: '新類型名稱（例：化學品外洩）',
  addEventTypeSubmit: '新增並選用',
  addEventTypeCancel: '取消',
  userMgmtEmployeesByDept: '員工（依部門）',
  userMgmtEmployeesByDeptDesc: '點選部門查看該部門員工名單。',
  userMgmtEmployeeCount: (n) => `${n} 人`,
  userMgmtDeptRosterTitle: (deptName) => `${deptName} · 員工名單`,
  userMgmtBackToDepts: '返回部門列表',
  userMgmtNoEmployeesInDept: '此部門尚無員工帳號。',
  adminOverviewCreateTitle: '建立新事件',
  adminOverviewCreateBody: '事件建立後立即生效，並向目標部門員工送出通知。',
  adminOverviewCreateCta: '前往建立事件',
  adminCreateModalCancel: '關閉',
  adminEventCenterSubtitle: '全域事件清單與狀態總覽',
  adminEventCenterSearchPlaceholder: '搜尋事件名稱',
  adminEventCenterReportProgress: '回報進度',
  adminEventCenterReportedOfTotal: (reported, total) => `${reported} / ${total} 已回報`,
  adminEventCenterStatusColumn: '狀態統計',
  adminEventCenterLastUpdate: '最後更新',
  adminEventCenterTip:
    '小提醒：點擊事件可查看詳細資訊與人員名單，並進行後續處置與通知。',
  adminEventCenterTipDismissAria: '關閉提示',
  adminEventCenterPageRange: (from, to, total) => `顯示 ${from} - ${to} / ${total} 筆`,
  adminEventCenterPerPage: '每頁顯示',
  adminScopeAllEmployees: '全公司',
  adminEventCenterEmpty: '目前沒有符合條件的事件。',
  adminEventCenterColEvent: '事件',
  adminEventCenterColStatus: '狀態',
  adminEventCenterColProgress: '回報進度',
  adminEventCenterColStats: '狀態統計',
  adminEventCenterColAction: '操作',
};

const portalEn: PortalStrings = {
  adminGlobalEventCenter: 'Admin · Global Event Center',
  notificationEventCenter: 'Notification Event Center',
  eventManagement: 'Event Management',
  eventManagementIntro:
    'This page lists events only. On Overview, tap + and complete the popup to create an event (you return here after a successful save).',
  userDeptManagement: 'User & department management',
  employees: 'Employees',
  departmentHierarchy: 'Department hierarchy',
  managerSubordinatesHeading: 'Manager → direct reports',
  deptIdLabel: (id) => `Dept ID: ${id}`,
  pushEnabled: 'Push enabled',
  pushNotEnabled: 'Push off',
  unknownManager: 'Unknown manager',
  backToEventList: '← Back to events',
  notificationReminderCenter: 'Notifications & reminders',
  deliverySummary: 'Delivery summary',
  deliverySummaryIntro:
    'Summary of push/reminder activity for this event (local reminder batches plus notifications visible to this account).',
  pushSent: 'Push sent',
  pushFailed: 'Push failed',
  smsFallback: 'SMS fallback',
  reminderActions: 'Reminder actions',
  reminderActionsIntro: 'Send a backend reminder to direct reports who have not responded (supervisors only).',
  sendReminderToNonResponders: 'Send reminder to non-responders',
  supervisorOnlyReminderTitle: 'Supervisor role required to send reminders',
  reminderHistory: 'Reminder history',
  noReminderRecords: 'No reminder history yet.',
  placeholderEventTitle: 'Event title',
  placeholderDescription: 'Description',
  placeholderCustomType: 'Custom type (e.g. chemical leak)',
  datetimeLabel: 'Start time',
  createEventButton: 'Create event',
  activateButton: 'Activate',
  closeEventButton: 'Close',
  formLabelEventType: 'Event type',
  formLabelNotifyTarget: 'Notify',
  notifyScopeAll: 'All employees',
  notifyScopeDepartments: 'Selected departments',
  notifyScopeDeptHint: 'Employees in sub-departments of your selection are included.',
  formLabelCustomTypeDetail: 'Custom type detail',
  eventTypeEarthquake: 'Earthquake',
  eventTypeTyphoon: 'Typhoon',
  eventTypeFire: 'Fire',
  eventTypeOther: 'Other',
  eventLabelType: 'Type',
  eventLabelStart: 'Start',
  eventChipDraft: 'Draft',
  eventChipActive: 'Active',
  eventChipClosed: 'Closed',
  noDescription: '(No description)',
  eventFilterLabel: 'Filter events by status',
  filterAll: 'All',
  filterActive: 'Active',
  filterDraft: 'Draft',
  filterClosed: 'Closed',
  failedDeliveries: 'Failed delivery list',
  failedDeliveriesHint: 'Shows recipients whose push delivery failed for this event.',
  refreshFailedList: 'Refresh failed list',
  noFailedDeliveries: 'No failed deliveries for this event.',
  retryDelivery: 'Retry',
  failedReminderRetryOkToast: 'Retry queued; status will update shortly.',
  failedReminderRetryErrToast: 'Retry failed. Please try again.',
  failedReminderLoadErrToast: 'Could not load failed delivery list.',
  adminOnlyManageFailed: 'Admin only',
  loading: 'Loading…',
  na: 'N/A',
  notSentYet: 'Not delivered yet',
  notificationInboxTitle: 'Notification inbox',
  notificationInboxIntro: 'Push and SMS records for your account (read-only).',
  notificationInboxEmpty: 'No notifications yet.',
  notificationInboxEventLabel: 'Event',
  notificationInboxChannelLabel: 'Channel',
  notificationInboxStatusLabel: 'Status',
  fabCreateEventAria: 'Create event',
  userMgmtAddAccount: 'Add account',
  userMgmtCreateSubmit: 'Create account',
  userMgmtNamePlaceholder: 'Name',
  userMgmtEmailPlaceholder: 'Email',
  userMgmtDeptLabel: 'Department',
  userMgmtPhoneLabel: 'Phone',
  userMgmtPhonePlaceholder: 'e.g. +14155550100',
  userMgmtEmployeeNoLabel: 'Employee number',
  userMgmtEmployeeNoPlaceholder: 'e.g. EMP2024001',
  userMgmtDeptPickHint: 'Select one department (hierarchy shown below).',
  userMgmtPhoneRequired: 'Phone number is required.',
  userMgmtEmployeeNoRequired: 'Employee number is required.',
  userMgmtTempPassword: (pw) => `Temporary password generated (share securely; user should change after login): ${pw}`,
  addEventTypeLink: '+ Add event type',
  addEventTypePlaceholder: 'New type name (e.g. Chemical spill)',
  addEventTypeSubmit: 'Add and select',
  addEventTypeCancel: 'Cancel',
  userMgmtEmployeesByDept: 'Employees by department',
  userMgmtEmployeesByDeptDesc: 'Tap a department to view its employee roster.',
  userMgmtEmployeeCount: (n) => `${n}`,
  userMgmtDeptRosterTitle: (deptName) => `${deptName} · Employees`,
  userMgmtBackToDepts: 'Back to departments',
  userMgmtNoEmployeesInDept: 'No employee accounts in this department.',
  adminOverviewCreateTitle: 'Create a new event',
  adminOverviewCreateBody: 'New events go live immediately and send activation notices to targeted employees.',
  adminOverviewCreateCta: 'Go to create event',
  adminCreateModalCancel: 'Close',
  adminEventCenterSubtitle: 'Global event list and status overview',
  adminEventCenterSearchPlaceholder: 'Search event title',
  adminEventCenterReportProgress: 'Reporting progress',
  adminEventCenterReportedOfTotal: (reported, total) => `${reported} / ${total} reported`,
  adminEventCenterStatusColumn: 'Status breakdown',
  adminEventCenterLastUpdate: 'Last updated',
  adminEventCenterTip:
    'Tip: open an event to see details, roster, follow-up actions, and notifications.',
  adminEventCenterTipDismissAria: 'Dismiss tip',
  adminEventCenterPageRange: (from, to, total) => `Showing ${from}–${to} of ${total}`,
  adminEventCenterPerPage: 'Rows per page',
  adminScopeAllEmployees: 'All employees',
  adminEventCenterEmpty: 'No events match the current filters.',
  adminEventCenterColEvent: 'Event',
  adminEventCenterColStatus: 'Status',
  adminEventCenterColProgress: 'Reporting progress',
  adminEventCenterColStats: 'Status breakdown',
  adminEventCenterColAction: 'Actions',
};

const statusBadgeZh: StatusBadgeStrings = {
  safe: '平安',
  needHelp: '需要協助',
  pending: '未回報',
};

const statusBadgeEn: StatusBadgeStrings = {
  safe: 'Safe',
  needHelp: 'Need Help',
  pending: 'No Response',
};

const employeeZh: EmployeeReportStrings = {
  submitting: '送出中…（弱網下可能自動重試，請稍候）',
  submitFailTitle: '無法送出回報',
  retry: '重試',
  close: '關閉',
  heroSublineReporting: (name: string) => `Hi ${name}，請確認你的狀態是否平安。`,
  heroSublineHasReport: '請於下方檢視或更新你的回報。',
  heroSublineDraft: '請更新並儲存你的回報。',
  reportCardTitle: '回報你的狀態',
  supplementaryTitle: '需要協助 — 請填寫（可協助搜救）',
  optionalBadge: '選填',
  locationLabel: '位置',
  commentLabel: '備註',
  attachTitle: '附件',
  dropTitle: '拖曳檔案到此，或點此瀏覽',
  dropHint: '支援圖片、影片與文件（各自最大 10MB）',
  removeAttachment: '移除附件',
  uploadTooBig: '單檔不得超過 10MB',
  submitNeedHelp: '送出 · 需要協助',
  backToEventsAria: '返回事件列表',
  noEventSelected: '目前沒有選取的事件',
  locationPlaceholder: '例如：A 棟 3F',
  commentPlaceholder: '可簡述現況…',
  cardPendingLabel: '待回報',
  cardReportedSafeLabel: '已回報 · 平安',
  cardReportedNeedLabel: '已回報 · 需要協助',
  cardAskSubmitHint: '請儘速完成狀態回報。',
  cardRespondedHint: (timeStr: string) => `您已於 ${timeStr} 回報`,
  cardClosedBadge: '已結束',
  cardIamSafeShort: '平安',
  cardNeedHelpShort: '需要協助',
  cardNoSubmissionClosed: '無回報紀錄。',
  cardContinue: '繼續',
  cardViewLabel: '檢視',
  reportSuccessTitle: '已回報成功',
  statusDetailSafe: '狀態：平安（I\'m Safe）',
  statusDetailNeedHelp: '狀態：需要協助（I need help）',
  supplementOrUpdate: '補充或更新資訊',
  overlaySubmittedSafe: '已送出：平安',
  overlaySubmittedNeedHelp: '已送出：需要協助',
  supervisorNudgeTitle: '已回報成功',
  supervisorNudgeBody: (eventTitle, pendingPct) =>
    `事件「${eventTitle}」轄下尚有 ${pendingPct}% 未回報，可前往團隊報表追蹤。`,
  idleHeroTitle: '目前無須立即回報',
  idleHeroSubtitle: '若需補充資料請於下方進行中事件操作；可向下捲動檢視已結束事件。',
  sectionOngoingEvents: '進行中',
  sectionClosedEvents: '已結束',
  idleNoOngoingSupplemented: '尚無已回報且仍進行中的事件。',
  idleNoClosedHistory: '尚無已結束事件紀錄。',
  emergencyContactTitle: '緊急聯絡',
  priorityStackAria: '待回報事件',
  reportNowHeroTitle: '立即回報',
  reportNowHeroSubtitle: '請先按下平安或需要協助完成首報；補充說明可於送出後再填寫。',
  dualYourResponse: '您的回報',
  dualTeamOverview: (total) => `團隊概覽（${total}）`,
  dualAriaTeamSummary: '團隊回報摘要',
  dualPersonalSafeClosed: '個人 · 平安',
  dualPersonalNeedClosed: '個人 · 需要協助',
  dualNoPersonalSubmissionClosed: '尚無個人回報。',
  teamMiniSafe: (n) => `${n} 平安`,
  teamMiniNeed: (n) => `${n} 需要協助`,
  teamMiniPending: (n) => `${n} 待回報`,
  submittedAtLabel: '送出時間',
  editReport: '編輯回報',
  done: '完成',
  revisionDetailsHeading: '補充詳情',
  replaceAttachment: '更換',
  removeAttachmentAria: '移除附件',
};

const employeeEn: EmployeeReportStrings = {
  submitting: 'Submitting… Retries automatically on flaky networks.',
  submitFailTitle: 'Could not submit report',
  retry: 'Retry',
  close: 'Dismiss',
  heroSublineReporting: (name) => `${name}, please confirm whether you’re safe.`,
  heroSublineHasReport: 'Review or update your report below.',
  heroSublineDraft: 'Update your report and save your changes.',
  reportCardTitle: 'Report your status',
  supplementaryTitle: 'Need help — add details',
  optionalBadge: 'Optional',
  locationLabel: 'Location',
  commentLabel: 'Comment',
  attachTitle: 'Attached files',
  dropTitle: 'Drag files here or click to browse',
  dropHint: 'Images, video, docs — max 10MB each',
  removeAttachment: 'Remove attachment',
  uploadTooBig: 'Each file must be 10MB or smaller.',
  submitNeedHelp: 'Submit · I need help',
  backToEventsAria: 'Back to event list',
  noEventSelected: 'No event selected.',
  locationPlaceholder: 'e.g. Building A, 3F',
  commentPlaceholder: 'Briefly describe your situation…',
  cardPendingLabel: 'Pending response',
  cardReportedSafeLabel: "Reported · I'm Safe",
  cardReportedNeedLabel: 'Reported · I need help',
  cardAskSubmitHint: 'Please submit your status.',
  cardRespondedHint: (timeStr: string) => `You responded at ${timeStr}`,
  cardClosedBadge: 'Closed',
  cardIamSafeShort: "I'm Safe",
  cardNeedHelpShort: 'I need help',
  cardNoSubmissionClosed: 'No submission on file.',
  cardContinue: 'Continue',
  cardViewLabel: 'View',
  reportSuccessTitle: 'Report submitted',
  statusDetailSafe: "Status: I'm Safe",
  statusDetailNeedHelp: 'Status: I need help',
  supplementOrUpdate: 'Add or update details',
  overlaySubmittedSafe: "Submitted: I'm safe",
  overlaySubmittedNeedHelp: 'Submitted: I need help',
  supervisorNudgeTitle: 'Report submitted',
  supervisorNudgeBody: (eventTitle, pendingPct) =>
    `"${eventTitle}" still has ${pendingPct}% of your team pending. Open the team dashboard to follow up.`,
  idleHeroTitle: 'Nothing needs your immediate response',
  idleHeroSubtitle: 'To add details, use an ongoing event below. Scroll down for closed events.',
  sectionOngoingEvents: 'Ongoing',
  sectionClosedEvents: 'Closed',
  idleNoOngoingSupplemented: 'No ongoing events with a supplementable report.',
  idleNoClosedHistory: 'No closed events in your history.',
  emergencyContactTitle: 'Emergency contacts',
  priorityStackAria: 'Events awaiting your response',
  reportNowHeroTitle: 'Report now',
  reportNowHeroSubtitle: "Tap I'm Safe or I need help to submit once; add details afterward if needed.",
  dualYourResponse: 'Your response',
  dualTeamOverview: (total) => `Team overview (${total})`,
  dualAriaTeamSummary: 'Team response summary',
  dualPersonalSafeClosed: 'Personal · Safe',
  dualPersonalNeedClosed: 'Personal · Need help',
  dualNoPersonalSubmissionClosed: 'No personal submission.',
  teamMiniSafe: (n) => `${n} Safe`,
  teamMiniNeed: (n) => `${n} Need help`,
  teamMiniPending: (n) => `${n} Pending`,
  submittedAtLabel: 'Submitted at',
  editReport: 'Edit report',
  done: 'Done',
  revisionDetailsHeading: 'Additional details',
  replaceAttachment: 'Replace',
  removeAttachmentAria: 'Remove attachment',
};

