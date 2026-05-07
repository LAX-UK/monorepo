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

export class LotError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "LotError";
  }
}

export class AuthzError extends Error {
  constructor(
    message: string,
    readonly status: number = 403,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export class CategoryError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "CategoryError";
  }
}

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "SubmissionError";
  }
}
