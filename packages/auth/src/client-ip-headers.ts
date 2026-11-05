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
