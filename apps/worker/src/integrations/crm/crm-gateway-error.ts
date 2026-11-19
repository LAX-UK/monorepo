export class CrmGatewayError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  /** The field the CRM named when it refused the record (an API name, never a value). */
  readonly fieldApiName?: string;
  /**
   * The delivery waits on another delivery settling, rather than failing: retried without using up
   * an attempt (see `isWaitingDeliveryError`), for at most `maxWaitMs` from the delivery's creation.
   */
  readonly waiting?: true;
  readonly maxWaitMs?: number;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    retryable: boolean;
    retryAfterMs?: number;
    fieldApiName?: string;
    waiting?: { maxWaitMs: number };
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
    if (input.waiting !== undefined) {
      this.waiting = true;
      this.maxWaitMs = input.waiting.maxWaitMs;
    }
  }
}

/** How often a delivery waiting on another one looks again. */
export const CRM_WAITING_RETRY_AFTER_MS = 60_000;

/**
 * How long, from its creation, a delivery may wait on another one without using up attempts. Past
 * it, each wait counts as an attempt again, so the delivery dead-letters (replayable) after the
 * usual attempts instead of waiting for ever.
 */
export const CRM_WAITING_MAX_MS = 24 * 60 * 60_000;

const CRM_WAITING = {
  retryAfterMs: CRM_WAITING_RETRY_AFTER_MS,
  waiting: { maxWaitMs: CRM_WAITING_MAX_MS },
} as const;

export function crmPersonNotLinkedError(): CrmGatewayError {
  return new CrmGatewayError({
    code: "person_not_linked",
    message: "person_not_linked",
    status: 409,
    retryable: true,
  });
}

/**
 * The deal an event moves is not in the ledger yet, and the CRM delivery of the event that creates
 * it is still to run. A wait, not a failure: tried again every minute without using up attempts, so
 * it never dead-letters while that delivery is still retryable (a long Zoho outage). The wait ends
 * when that delivery ends (the deal is linked, or it is skipped or dead-lettered and this one is
 * skipped), and in any case after `CRM_WAITING_MAX_MS`.
 */
export function crmDealNotLinkedError(): CrmGatewayError {
  return new CrmGatewayError({
    code: "deal_link_missing",
    message: "deal_link_missing",
    status: 409,
    retryable: true,
    ...CRM_WAITING,
  });
}

/**
 * Another delivery has claimed the note and may be sending it; tried again once it is done. A wait,
 * not a failure: it never uses up attempts, so the note is not dead-lettered while the claim's
 * grace period (`CRM_NOTE_PENDING_GRACE_MS`) runs out. The wait ends when the claimant records or
 * refuses the note, or once the grace period lets this delivery take the claim over, and in any
 * case after `CRM_WAITING_MAX_MS`.
 */
export function crmNoteInFlightError(): CrmGatewayError {
  return new CrmGatewayError({
    code: "deal_note_in_flight",
    message: "deal_note_in_flight",
    status: 409,
    retryable: true,
    ...CRM_WAITING,
  });
}

/**
 * True when the CRM certainly did not apply a write: Zoho answered with a 4xx other than a request
 * timeout, or the request was never sent (circuit open). A 5xx, a timeout or a dropped connection
 * may have been applied.
 */
export function isDefiniteCrmRefusal(err: unknown): boolean {
  if (!(err instanceof CrmGatewayError)) return false;
  if (err.code === "circuit_open") return true;
  return err.status >= 400 && err.status < 500 && err.status !== 408;
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
