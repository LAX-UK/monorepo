export class BidError extends Error {
  readonly code?: string | undefined;
  /** Facts a client needs to phrase the refusal (for example a limit and the room left). */
  readonly details?: Readonly<Record<string, string>> | undefined;
  constructor(
    message: string,
    readonly status: number = 400,
    code?: string,
    details?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = "BidError";
    this.code = code;
    this.details = details;
  }
}
