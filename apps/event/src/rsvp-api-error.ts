export class RsvpApiError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RsvpApiError";
  }
}

export function isRsvpApiError(error: unknown): error is RsvpApiError {
  return error instanceof RsvpApiError;
}
