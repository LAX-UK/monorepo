export interface ISignedUrlPolicy {
  signingDate(now: Date): Date;
  readonly expiresInSec: number;
}

export class PerRequestSigningPolicy implements ISignedUrlPolicy {
  constructor(private readonly ttlSec: number) {}

  signingDate(now: Date): Date {
    return now;
  }

  get expiresInSec(): number {
    return this.ttlSec;
  }
}

/** Rounds signing time to UTC midnight so repeated reads produce stable presigned URLs. */
export class StableSigningPolicy implements ISignedUrlPolicy {
  constructor(private readonly ttlSec: number) {}

  signingDate(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  get expiresInSec(): number {
    return this.ttlSec;
  }
}
