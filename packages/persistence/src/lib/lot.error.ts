/** Shared catalogue/lot error used by persistence soft-delete paths and api services. */
export class LotError extends Error {
  readonly code?: string | undefined;
  readonly meta?: Record<string, unknown>;

  constructor(
    message: string,
    readonly status: number = 400,
    code?: string,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LotError";
    if (code !== undefined) this.code = code;
    if (meta !== undefined) this.meta = meta;
  }
}
