export const CLIENT_IP_HEADER_NAMES = {
  cloudflare: "cf-connecting-ip",
  digitalOcean: "do-connecting-ip",
  forwardedFor: "x-forwarded-for",
  realIp: "x-real-ip",
} as const;

/** Headers Better Auth reads for its own session and rate-limit records, in order. */
export const AUTH_IP_ADDRESS_HEADERS = [
  CLIENT_IP_HEADER_NAMES.cloudflare,
  CLIENT_IP_HEADER_NAMES.digitalOcean,
  CLIENT_IP_HEADER_NAMES.forwardedFor,
] as const;

/**
 * Internal header carrying the client address the issuer app resolved from the TCP peer. Better
 * Auth hooks only see headers, so they read this one. The app removes any client-sent copy and sets
 * it from its peer-checked resolver before the request reaches them; nothing else may set it.
 */
export const TRUSTED_CLIENT_IP_HEADER = "x-lax-trusted-client-ip";

/** Drops any client-sent trusted-address header, then sets it to the resolved address if known. */
export function stampTrustedClientIp(headers: Headers, resolvedIp: string | undefined): void {
  headers.delete(TRUSTED_CLIENT_IP_HEADER);
  if (resolvedIp && resolvedIp !== "unknown") headers.set(TRUSTED_CLIENT_IP_HEADER, resolvedIp);
}

/** The address the issuer app resolved for this request, or undefined when it could not. */
export function readTrustedClientIp(headers: Headers | undefined): string | undefined {
  return headers?.get(TRUSTED_CLIENT_IP_HEADER)?.trim() || undefined;
}
