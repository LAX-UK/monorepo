export class CrmGatewayError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  /** The field the CRM named when it refused the record (an API name, never a value). */
  readonly fieldApiName?: string;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    retryable: boolean;
    retryAfterMs?: number;
    fieldApiName?: string;
  }) {
    super(input.message);
    this.name = "CrmGatewayError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable;
    if (input.retryAfterMs !== undefined) {
      this.retryAfterMs = input.retryAfterMs;
    }
    if (input.fieldApiName !== undefined) {
      this.fieldApiName = input.fieldApiName;
    }
  }
}

export function crmPersonNotLinkedError(): CrmGatewayError {
  return new CrmGatewayError({
    code: "person_not_linked",
    message: "person_not_linked",
    status: 409,
    retryable: true,
  });
}

/** Zoho error codes are upper-case words such as `INVALID_DATA`; anything else is not kept. */
const REFUSAL_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** Field API names such as `Lead_Source`; a value never matches because it is never sent here. */
const FIELD_API_NAME = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;

export function safeRefusalCode(code: unknown): string | undefined {
  return typeof code === "string" && REFUSAL_CODE.test(code) ? code : undefined;
}

export function safeFieldApiName(name: unknown): string | undefined {
  return typeof name === "string" && FIELD_API_NAME.test(name) ? name : undefined;
}

/**
 * The reason stored for a delivery the CRM refused: the HTTP status, then Zoho's error code and
 * the field it named, e.g. `zoho_crm_http_400:INVALID_DATA:Lead_Source`. It holds only the code
 * and the field's API name, never a field value or anything about the person.
 */
export function crmRefusalReason(input: {
  status: number;
  code?: string | undefined;
  fieldApiName?: string | undefined;
}): string {
  const base = `zoho_crm_http_${input.status}`;
  const code = safeRefusalCode(input.code);
  if (!code) return base;
  const field = safeFieldApiName(input.fieldApiName);
  return field ? `${base}:${code}:${field}` : `${base}:${code}`;
}

/** A record the CRM refused, as a delivery error that records why. */
export function crmRecordRefusedError(
  failed: { code?: string | undefined; fieldApiName?: string | undefined },
  status = 400,
): CrmGatewayError {
  const code = safeRefusalCode(failed.code);
  const fieldApiName = safeFieldApiName(failed.fieldApiName);
  return new CrmGatewayError({
    code: code ?? "ERROR",
    message: crmRefusalReason({ status, code, fieldApiName }),
    status,
    retryable: false,
    ...(fieldApiName ? { fieldApiName } : {}),
  });
}

/** The stored reason when a person's email cannot be sent to, or is refused by, Zoho. */
export const EMAIL_REJECTED_BY_ZOHO = "email_rejected_by_zoho";

/**
 * A person's email Zoho cannot store. The delivery is parked, not retried: sending the same
 * address again gets the same refusal. The reason names the rule or Zoho's code, never the address.
 */
export function crmEmailRejectedError(detail: string, status = 400): CrmGatewayError {
  return new CrmGatewayError({
    code: EMAIL_REJECTED_BY_ZOHO,
    message: `${EMAIL_REJECTED_BY_ZOHO}:${detail}`,
    status,
    retryable: false,
    fieldApiName: "Email",
  });
}
