import type { EventItem, SafetyResponse } from '../../types';

/**
 * 員工事件列表 UI 模式，由 App.tsx 的 `memberHomeMode` 依組織關係計算：
 *
 * - **1**：無直屬部屬 → 只關心「自己要不要回報」（單張事件卡）
 * - **2**：有部屬且也有上級 → 「自己回報」+「部屬概況」雙卡
 * - **3**：有部屬但無上級（組織頂層主管）→ 只看部屬回報進度（團隊卡）
 */
export type MemberMode = 1 | 2 | 3;

export type EventFilterTab = 'ongoing' | 'closed';

export type PendingSubmission = 'safe' | 'need_help' | null;

export type EmployeeReportFields = {
  comment: string;
  location: string;
  attachment: File | null;
};

export type TeamCounts = {
  total: number;
  safe: number;
  needHelp: number;
  pending: number;
};

export type MemberHomeRow = {
  event: EventItem;
  latest?: SafetyResponse;
  teamCounts?: TeamCounts;
};
