/** Typed domain errors for Stripe Connect services (stable codes for route translation). */
export class ConnectServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly meta: Record<string, unknown>;

  constructor(code: string, httpStatus = 400, meta: Record<string, unknown> = {}) {
    super(code);
    this.name = "ConnectServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.meta = meta;
  }
}

export function throwConnectError(
  code: string,
  httpStatus = 400,
  meta: Record<string, unknown> = {},
): never {
  throw new ConnectServiceError(code, httpStatus, meta);
}
