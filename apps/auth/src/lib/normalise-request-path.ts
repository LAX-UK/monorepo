/**
 * A request path in the one form the security checks compare against: decoded, in lower case,
 * with repeated slashes collapsed and no trailing slash. The router may accept `/passkey/x/`,
 * `//passkey/x` or `/Passkey/X`, so a check that looked at the raw path could be walked around by
 * writing the path differently.
 */
export function normaliseRequestPath(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // An undecodable path is compared as written.
  }
  return decoded
    .toLowerCase()
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");
}
