import type { Context } from "hono";

type ComplianceHttpStatus = 400 | 403 | 404 | 409;

/** Domain compliance errors → stable HTTP status codes for admin routes. */
export const COMPLIANCE_ROUTE_ERROR_MAP = {
  aml_triage_self_forbidden: 403,
  aml_screening_not_pending: 409,
  aml_triage_already_set: 409,
  aml_screening_not_found: 404,
  aml_review_self_forbidden: 403,
  aml_review_same_as_triager: 403,
  aml_triage_required: 409,
  source_of_funds_triage_self_forbidden: 403,
  source_of_funds_not_pending: 409,
  source_of_funds_triage_already_set: 409,
  source_of_funds_not_found: 404,
  source_of_funds_review_self_forbidden: 403,
  source_of_funds_review_same_as_triager: 403,
  source_of_funds_triage_required: 409,
  source_of_funds_not_rejected: 409,
  source_of_funds_documents_already_requested: 409,
  source_of_funds_document_types_required: 400,
  source_of_funds_document_not_found: 409,
  source_of_funds_document_superseded: 409,
} as const satisfies Record<string, ComplianceHttpStatus>;

export type ComplianceRouteErrorCode = keyof typeof COMPLIANCE_ROUTE_ERROR_MAP;

/** Maps compliance route failures to stable HTTP responses; returns null to rethrow. */
export function respondComplianceRouteError(c: Context, err: unknown): Response | null {
  if (!(err instanceof Error)) return null;
  const status = COMPLIANCE_ROUTE_ERROR_MAP[err.message as ComplianceRouteErrorCode];
  if (status === undefined) return null;
  return c.json({ error: err.message }, status);
}
