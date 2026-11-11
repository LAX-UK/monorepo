/**
 * UTF-8 text <-> unpadded base64url, on web-standard APIs only (`TextEncoder`, `btoa`, `atob`).
 * Browser bundles that refer to Node's `Buffer` get a polyfill injected, and that polyfill does not
 * support the `base64url` encoding (it throws `Unknown encoding: base64url`). Packages whose code
 * can run in the browser must therefore encode and decode through these helpers, never `Buffer`.
 */

export function encodeUtf8Base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Returns `null` when `encoded` is not valid base64url. */
export function decodeUtf8Base64Url(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
