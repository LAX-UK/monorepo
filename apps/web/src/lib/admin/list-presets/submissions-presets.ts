import { buildListHref } from "@/lib/admin/admin-list-params";

export type SubmissionPresetId = "all" | "intake" | "approved" | "rejected";

const BASE = "/admin/submissions";

export function submissionListPresetHref(
  id: SubmissionPresetId,
  current: Record<string, string | string[] | undefined>,
): string {
  switch (id) {
    case "intake":
      return buildListHref(BASE, current, { status: "under_review", offset: 0 });
    case "approved":
      return buildListHref(BASE, current, { status: "approved", offset: 0 });
    case "rejected":
      return buildListHref(BASE, current, { status: "rejected", offset: 0 });
    default:
      return buildListHref(BASE, current, { status: "", offset: 0 });
  }
}

export function submissionListActivePreset(
  q: Record<string, string | string[] | undefined>,
): SubmissionPresetId {
  const status = String(Array.isArray(q.status) ? q.status[0] : (q.status ?? ""));
  if (status === "under_review" || status === "submitted") return "intake";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "all";
}
