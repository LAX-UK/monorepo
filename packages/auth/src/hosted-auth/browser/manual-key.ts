/** Groups the base32 secret in fours so it can be typed into an authenticator by hand. */
export function formatManualKey(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}
