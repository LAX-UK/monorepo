const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
]);

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPrivateIpv4Host(host: string): boolean {
  const octets = parseIpv4(host);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b !== undefined && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b !== undefined && b === 168) return true;
  return false;
}

/** Returns true when the URL uses http(s) and does not target obvious local/private hosts. */
export function isSafePublicHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(host)) return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (isPrivateIpv4Host(host)) return false;
    return true;
  } catch {
    return false;
  }
}
