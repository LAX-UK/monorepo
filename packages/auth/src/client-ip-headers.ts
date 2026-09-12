export const CLIENT_IP_HEADER_NAMES = {
  cloudflare: "cf-connecting-ip",
  digitalOcean: "do-connecting-ip",
  forwardedFor: "x-forwarded-for",
  realIp: "x-real-ip",
} as const;

export const AUTH_IP_ADDRESS_HEADERS = [
  CLIENT_IP_HEADER_NAMES.cloudflare,
  CLIENT_IP_HEADER_NAMES.digitalOcean,
  CLIENT_IP_HEADER_NAMES.forwardedFor,
] as const;

export function readForwardedClientIp(
  header: (name: string) => string | undefined,
): string | undefined {
  return (
    header(CLIENT_IP_HEADER_NAMES.cloudflare)?.trim() ||
    header(CLIENT_IP_HEADER_NAMES.digitalOcean)?.trim() ||
    header(CLIENT_IP_HEADER_NAMES.forwardedFor)?.split(",")[0]?.trim() ||
    header(CLIENT_IP_HEADER_NAMES.realIp)?.trim() ||
    undefined
  );
}
