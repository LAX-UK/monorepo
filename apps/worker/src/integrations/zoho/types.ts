export type ZohoCrmModule = "Leads" | "Contacts" | "Deals";

export class ZohoCrmHttpError extends Error {
  readonly status: number;
  readonly body: string;
  readonly retryAfterMs?: number;

  constructor(status: number, body: string, retryAfterMs?: number) {
    super(`zoho_crm_http_${status}`);
    this.name = "ZohoCrmHttpError";
    this.status = status;
    this.body = body;
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
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
