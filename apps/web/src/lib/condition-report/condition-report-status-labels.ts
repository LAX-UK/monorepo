import type { ConditionReportRequestStatus } from "@/lib/condition-report/condition-report-types";

export function conditionReportStatusLabel(status: ConditionReportRequestStatus): string {
  switch (status) {
    case "pending":
      return "Requested";
    case "in_progress":
      return "In progress";
    case "fulfilled":
      return "Ready";
    case "declined":
      return "Unavailable";
  }
}
