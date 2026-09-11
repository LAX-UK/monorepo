const DEFAULT_IDENTITY_PUBLIC_BASE_URL = "http://localhost:3001";

export function identityPublicBaseUrl(): string {
  const configured = process.env.IDENTITY_PUBLIC_BASE_URL?.trim();
  return (
    configured && configured.length > 0 ? configured : DEFAULT_IDENTITY_PUBLIC_BASE_URL
  ).replace(/\/+$/, "");
}
