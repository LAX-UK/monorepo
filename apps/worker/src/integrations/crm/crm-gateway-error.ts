export class CrmGatewayError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    retryable: boolean;
    retryAfterMs?: number;
  }) {
    super(input.message);
    this.name = "CrmGatewayError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable;
    if (input.retryAfterMs !== undefined) {
      this.retryAfterMs = input.retryAfterMs;
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
