import { isIdentityRejected, isIdentityUnavailable } from "@auction/identity-rp";

export type TokenExchangeFailureMetadata = {
  tokenExchangeFailureClass: "rejected" | "unavailable";
  oauthError?: string;
};

export function describeTokenExchangeFailure(error: unknown): TokenExchangeFailureMetadata {
  if (isIdentityRejected(error)) {
    return {
      tokenExchangeFailureClass: "rejected",
      ...(error.oauthError ? { oauthError: error.oauthError } : {}),
    };
  }
  if (isIdentityUnavailable(error)) {
    return { tokenExchangeFailureClass: "unavailable" };
  }
  return { tokenExchangeFailureClass: "unavailable" };
}
