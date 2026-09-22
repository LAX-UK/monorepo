export type ShopIdentityUpstreamCode = "oidc_token_exchange" | "shop_api_fetch" | "configuration";

export class ShopIdentityUpstreamError extends Error {
  readonly kind = "identity_upstream" as const;

  constructor(
    message: string,
    readonly code: ShopIdentityUpstreamCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ShopIdentityUpstreamError";
  }
}
