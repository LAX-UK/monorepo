export type ConditionReportRequestStatus = "pending" | "in_progress" | "fulfilled" | "declined";

export type ConditionReportRequestSnapshot = {
  id: string;
  lotId: string;
  status: ConditionReportRequestStatus;
  requestNote: string | null;
  responseNote: string | null;
  createdAt: string;
};

export type PublishedConditionReport = {
  summary?: string | null;
  downloadUrl?: string | null;
};
