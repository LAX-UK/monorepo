import { IdentityRejectedError, IdentityUnavailableError } from "@auction/identity-rp";

export type TokenExchangeFailureMetadata = {
  tokenExchangeFailureClass: "rejected" | "unavailable";
  oauthError?: string;
};

export function describeTokenExchangeFailure(error: unknown): TokenExchangeFailureMetadata {
  if (error instanceof IdentityRejectedError) {
    return {
      tokenExchangeFailureClass: "rejected",
      ...(error.oauthError ? { oauthError: error.oauthError } : {}),
    };
  }
  if (error instanceof IdentityUnavailableError) {
    return { tokenExchangeFailureClass: "unavailable" };
  }
  return { tokenExchangeFailureClass: "unavailable" };
}
