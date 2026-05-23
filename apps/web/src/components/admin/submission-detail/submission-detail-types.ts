export const SUBMISSION_DETAIL_TABS = ["overview", "documents", "decision"] as const;

export type SubmissionDetailTab = (typeof SUBMISSION_DETAIL_TABS)[number];

export function submissionDetailTabHref(submissionId: string, tab: SubmissionDetailTab): string {
  if (tab === "overview") return `/admin/submissions/${submissionId}`;
  return `/admin/submissions/${submissionId}/${tab}`;
}

export function parseSubmissionDetailTabFromPath(
  pathname: string,
  submissionId: string,
): SubmissionDetailTab {
  const prefix = `/admin/submissions/${submissionId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "overview";
  for (const tab of SUBMISSION_DETAIL_TABS) {
    if (tab === "overview") continue;
    if (pathname === `${prefix}/${tab}` || pathname.startsWith(`${prefix}/${tab}/`)) {
      return tab;
    }
  }
  return "overview";
}
