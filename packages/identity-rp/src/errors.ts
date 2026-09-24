export class IdentityUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityUnavailableError";
  }
}

export class IdentityRejectedError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly oauthError?: string,
  ) {
    super(message);
    this.name = "IdentityRejectedError";
  }
}

export function throwTokenEndpointFailure(
  status: number | null,
  message: string,
  oauthError?: string,
): never {
  if (status === null || status >= 500 || status === 429 || status === 408) {
    throw new IdentityUnavailableError(message);
  }
  throw new IdentityRejectedError(status, message, oauthError);
}

export function isIdentityUnavailable(error: unknown): boolean {
  return error instanceof IdentityUnavailableError;
}

export function isIdentityRejected(error: unknown): boolean {
  return error instanceof IdentityRejectedError;
}
