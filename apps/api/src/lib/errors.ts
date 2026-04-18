export class BidError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "BidError";
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

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "SubmissionError";
  }
}
