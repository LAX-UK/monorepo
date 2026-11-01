import type { ConditionReportRequestStatus } from "@/lib/condition-report/condition-report-types";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";

/**
 * How each condition report request is drawn: one still with our specialists is information, a
 * ready report is good news, and one we could not prepare is neutral (the row says why).
 */
export const CONDITION_REPORT_STATUS_BADGE: Record<
  ConditionReportRequestStatus,
  { tone: StatusBadgeTone; shape: StatusBadgeShape }
> = {
  pending: { tone: "info", shape: "dot" },
  in_progress: { tone: "info", shape: "dot" },
  fulfilled: { tone: "success", shape: "check" },
  declined: { tone: "neutral", shape: "ring" },
};
