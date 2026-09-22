const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type ProductUrlValidationOptions = {
  /** Allow http://localhost and http://127.0.0.1 (default true). */
  allowLocalhostHttp?: boolean;
};

export function normalizeProductBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Product base URL is empty");
  }
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing;
}

export function isAllowedLaxProductUrl(
  raw: string,
  options: ProductUrlValidationOptions = {},
): boolean {
  const allowLocalhostHttp = options.allowLocalhostHttp ?? true;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.search || url.hash) return false;

  const host = url.hostname.toLowerCase();
  const isLocal = LOCALHOST_HOSTS.has(host);
  if (isLocal && allowLocalhostHttp) {
    return url.protocol === "http:" || url.protocol === "https:";
  }
  return url.protocol === "https:";
}
