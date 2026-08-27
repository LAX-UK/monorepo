import type {
  ConditionReportRequestSnapshot,
  ConditionReportRequestStatus,
} from "@/lib/condition-report/condition-report-types";

export function parseConditionReportRequestRow(
  raw: unknown,
): ConditionReportRequestSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (
    status !== "pending" &&
    status !== "in_progress" &&
    status !== "fulfilled" &&
    status !== "declined"
  ) {
    return null;
  }
  if (typeof o.id !== "string" || typeof o.lotId !== "string") return null;
  const createdAt =
    o.createdAt instanceof Date
      ? o.createdAt.toISOString()
      : typeof o.createdAt === "string"
        ? o.createdAt
        : new Date().toISOString();
  return {
    id: o.id,
    lotId: o.lotId,
    status: status as ConditionReportRequestStatus,
    requestNote: typeof o.requestNote === "string" ? o.requestNote : null,
    responseNote: typeof o.responseNote === "string" ? o.responseNote : null,
    createdAt,
  };
}
