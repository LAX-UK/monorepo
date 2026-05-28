import {
  type DashboardSliceFailure,
  buildDashboardSliceFailure,
  dashboardSliceFailureMessage,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { buildLegalEntityAccessFailure } from "@/lib/legal-entity/legal-entity-access-errors";
import { parseApiErrorCodeFromBody } from "@auction/validators";

/** @deprecated Use DashboardSliceFailure from dashboard-fetch-errors */
export type SubmissionsAccessFailure = DashboardSliceFailure;

/** Structured failure for seller submission list loads. */
export class SubmissionsAccessError extends Error {
  readonly failure: DashboardSliceFailure;

  constructor(failure: DashboardSliceFailure) {
    super(failure.message);
    this.name = "SubmissionsAccessError";
    this.failure = failure;
  }
}

/** Maps HTTP status + API error code to stable dashboard copy. */
export function buildSubmissionsAccessFailure(
  status: number,
  code: string | null,
): DashboardSliceFailure {
  if (code) {
    const le = buildLegalEntityAccessFailure("submissions", status, code);
    return { slice: "submissions", ...le };
  }
  return buildDashboardSliceFailure("submissions", status, null);
}

/** Reads a failed submissions API response into structured dashboard copy. */
export async function parseSubmissionsAccessFailure(res: Response): Promise<DashboardSliceFailure> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    errorCode?: string;
    code?: string;
  };
  const code = parseApiErrorCodeFromBody(body);
  return buildSubmissionsAccessFailure(res.status, code);
}

export function submissionsAccessFailureFromError(error: unknown): DashboardSliceFailure | null {
  if (error instanceof SubmissionsAccessError) return error.failure;
  return null;
}

export function submissionsFailureFromCaught(error: unknown): DashboardSliceFailure {
  const structured = submissionsAccessFailureFromError(error);
  if (structured) return structured;
  return describeDashboardSliceFailure(error, "submissions", "Could not load submissions.");
}

export function describeSubmissionsAccessForOverview(error: unknown, fallback: string): string {
  return dashboardSliceFailureMessage(error, "submissions", fallback);
}
