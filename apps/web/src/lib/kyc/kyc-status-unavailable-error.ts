export const KYC_STATUS_UNAVAILABLE_ERROR_NAME = "KycStatusUnavailableError";

export class KycStatusUnavailableError extends Error {
  readonly status: number | undefined;

  constructor(status?: number) {
    super(`[kyc] status lookup failed status=${status ?? "network"}`);
    this.name = KYC_STATUS_UNAVAILABLE_ERROR_NAME;
    this.status = status;
  }
}

export function isKycStatusUnavailableError(error: unknown): error is KycStatusUnavailableError {
  return (
    error instanceof KycStatusUnavailableError ||
    (error instanceof Error && error.name === KYC_STATUS_UNAVAILABLE_ERROR_NAME)
  );
}
