import { safeFieldApiName, safeRefusalCode } from "../crm/crm-gateway-error.js";

/** What Zoho said when it refused a request: its error code and the field it named. */
export type ZohoErrorDetail = { code?: string; fieldApiName?: string };

type ZohoErrorShape = {
  code?: unknown;
  status?: unknown;
  details?: { api_name?: unknown; column_name?: unknown; param_name?: unknown } | null;
};

/**
 * Reads Zoho's reason from an error body. Zoho answers in two shapes: one error for the whole
 * request (`{ code, details, message, status }`) or one per record (`{ data: [ ... ] }`, used when
 * a single record is refused with HTTP 400). Only the code and the field's API name are kept;
 * Zoho's message and anything that could hold a value are dropped.
 */
export function readZohoErrorDetail(bodyText: string): ZohoErrorDetail {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  const body = parsed as ZohoErrorShape & { data?: unknown };
  const rows = Array.isArray(body.data) ? (body.data as unknown[]) : [];
  const row =
    rows.find(
      (candidate): candidate is ZohoErrorShape =>
        typeof candidate === "object" &&
        candidate !== null &&
        (candidate as ZohoErrorShape).status === "error",
    ) ?? body;
  const code = safeRefusalCode(row.code);
  if (!code) return {};
  const details = row.details ?? undefined;
  const fieldApiName =
    safeFieldApiName(details?.api_name) ??
    safeFieldApiName(details?.column_name) ??
    safeFieldApiName(details?.param_name);
  return fieldApiName ? { code, fieldApiName } : { code };
}
