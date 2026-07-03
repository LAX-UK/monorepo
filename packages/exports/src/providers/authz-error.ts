export class AuthzError extends Error {
  readonly code?: string;

  constructor(
    message: string,
    readonly status: number = 403,
    code?: string,
  ) {
    super(message);
    this.name = "AuthzError";
    if (code !== undefined) this.code = code;
  }
}
