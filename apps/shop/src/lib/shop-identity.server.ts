const DEFAULT_SHOP_IDENTITY_BASE_URL = "http://localhost:3010";

export function shopIdentityBaseUrl(): string {
  const configured = process.env.SHOP_IDENTITY_BASE_URL?.trim();
  return (configured && configured.length > 0 ? configured : DEFAULT_SHOP_IDENTITY_BASE_URL).replace(
    /\/+$/,
    "",
  );
}
