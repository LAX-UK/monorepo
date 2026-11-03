/**
 * Where the data download lives and what its query values mean. Kept free of any server-only
 * import so the page's client components can use it.
 */
export const DATA_EXPORT_ROUTE = "/account/privacy/download";
/** The route a download form posts to; it re-checks the sign-in and redirects to the file. */
export const DATA_EXPORT_FILE_ROUTE = "/account/privacy/download/file";

/** Query values the page understands, set by the step-up return and by the download route. */
export const DATA_EXPORT_RESUME_PARAM = "resume";
export const DATA_EXPORT_PROBLEM_PARAM = "problem";
export type DataExportResume = "request" | "download";
export type DataExportProblem = "download_unavailable" | "step_up_failed";

export function parseDataExportResume(raw: string | undefined): DataExportResume | null {
  return raw === "request" || raw === "download" ? raw : null;
}

export function parseDataExportProblem(raw: string | undefined): DataExportProblem | null {
  return raw === "download_unavailable" || raw === "step_up_failed" ? raw : null;
}

/** Where a fresh sign-in returns to, and what it should finish when it gets there. */
export function dataExportReturnTo(resume: DataExportResume): string {
  return `${DATA_EXPORT_ROUTE}?${DATA_EXPORT_RESUME_PARAM}=${resume}`;
}
