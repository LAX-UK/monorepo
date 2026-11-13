import { crmRefusalReason } from "../crm/crm-gateway-error.js";
import { readZohoErrorDetail } from "./zoho-crm-error-detail.js";

export type ZohoCrmModule = "Leads" | "Contacts" | "Deals" | "Products" | "Arts";

/**
 * A request Zoho answered with an HTTP error. On a 4xx the message also carries Zoho's error code
 * and the field it named (`zoho_crm_http_400:INVALID_DATA:Lead_Source`), so the stored reason says
 * why without keeping the body, which can echo the values that were sent.
 */
export class ZohoCrmHttpError extends Error {
  readonly status: number;
  readonly body: string;
  readonly retryAfterMs?: number;
  /** Zoho's error code, for example `INVALID_DATA` or `MANDATORY_NOT_FOUND`. */
  readonly zohoCode?: string;
  /** The field Zoho named (`details.api_name`). */
  readonly fieldApiName?: string;

  constructor(status: number, body: string, retryAfterMs?: number) {
    const detail = status >= 400 && status < 500 ? readZohoErrorDetail(body) : {};
    super(crmRefusalReason({ status, code: detail.code, fieldApiName: detail.fieldApiName }));
    this.name = "ZohoCrmHttpError";
    this.status = status;
    this.body = body;
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
    if (detail.code !== undefined) this.zohoCode = detail.code;
    if (detail.fieldApiName !== undefined) this.fieldApiName = detail.fieldApiName;
  }
}

export class ZohoCrmAuthError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ZohoCrmAuthError";
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export class ZohoCrmRecordError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "ZohoCrmRecordError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
