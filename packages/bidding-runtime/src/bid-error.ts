export class BidError extends Error {
  readonly code?: string | undefined;
  constructor(
    message: string,
    readonly status: number = 400,
    code?: string,
  ) {
    super(message);
    this.name = "BidError";
    this.code = code;
  }
}
