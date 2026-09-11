const DEFAULT_SHOP_IDENTITY_BASE_URL = "http://localhost:3010";

export function shopIdentityBaseUrl(): string {
  const configured = process.env.SHOP_IDENTITY_BASE_URL?.trim();
  return (
    configured && configured.length > 0 ? configured : DEFAULT_SHOP_IDENTITY_BASE_URL
  ).replace(/\/+$/, "");
}

export function shopIdentityUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${shopIdentityBaseUrl()}${normalized}`;
}

export function shopIdentityCookieHeader(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): string | undefined {
  if (cookies.length === 0) return undefined;
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}
