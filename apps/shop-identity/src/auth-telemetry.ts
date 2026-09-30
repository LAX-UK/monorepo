type AuthLogPayload = Record<string, string | number | boolean | undefined>;

export function logShopIdentityAuth(event: string, payload: AuthLogPayload = {}): void {
  console.info(JSON.stringify({ service: "shop-identity", event, ...payload }));
}
