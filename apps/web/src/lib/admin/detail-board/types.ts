/** Entity-agnostic contracts for admin detail tab boards (sale, lot, category, …). */

import type {
  AdminTableDateTimeDeadlineKind,
  AdminTableDateTimeMode,
} from "@/lib/admin/format-admin-table-datetime";
import type { KpiTileTone } from "@auction/ui/components/kpi-tile";

export type DetailBoardKpiTile = {
  id: string;
  label: string;
  value: string;
  compareHint?: string;
  deltaPercent?: string;
  deltaDirection?: "up" | "down" | "neutral";
  trend?: readonly number[];
  trendTone?: KpiTileTone;
};

export type DetailBoardFilter<TId extends string = string> = {
  id: TId;
  label: string;
};

export type DetailAttentionSeverity = "critical" | "high" | "medium" | "low";

export type DetailAttentionIconKind =
  | "setup"
  | "registrations"
  | "catalog"
  | "finance"
  | "saleroom"
  | "telephone"
  | "delete"
  | "general";

export type DetailAttentionRow = {
  id: string;
  title: string;
  count: number;
  category: string;
  severity: DetailAttentionSeverity;
  actionLabel: string;
  href?: string;
  iconKind?: DetailAttentionIconKind;
};

export type DetailActivityRow = {
  id: string;
  label: string;
  detail: string;
  when: string;
  /** Optional initials for avatar fallback */
  actorInitials?: string;
};

export type DetailQualityGapSeverity = "required" | "warning";

export type DetailQualityGapRow = {
  id: string;
  field: string;
  message: string;
  severity: DetailQualityGapSeverity;
};

export type DetailStatRow = {
  id: string;
  label: string;
  value: string;
  /** When true, renders an approved/verified indicator beside the value. */
  verified?: boolean;
  /** Advisory text when verified is false (quality gap hint). */
  gapMessage?: string;
  /** When set, boards render AdminTableDateTimeCell instead of plain value. */
  dateIso?: string;
  dateMode?: AdminTableDateTimeMode;
  dateLive?: boolean;
  deadlineKind?: AdminTableDateTimeDeadlineKind;
};

export type DetailBoardToolbarState<TFilter extends string> = {
  search: string;
  filter: TFilter;
};
