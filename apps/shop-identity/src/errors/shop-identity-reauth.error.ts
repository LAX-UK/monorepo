export type ReauthReason = "no_session" | "no_refresh_token" | "refresh_rejected";

export class ShopIdentityReauthRequiredError extends Error {
  readonly kind = "reauth_required" as const;

  constructor(
    readonly reason: ReauthReason,
    message?: string,
  ) {
    super(message ?? "Sign in required");
    this.name = "ShopIdentityReauthRequiredError";
  }
}
