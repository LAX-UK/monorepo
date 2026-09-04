/** Product resource servers authenticate exact-audience Bearer credentials only. */
export function hasSessionCredential(headers: Headers): boolean {
  const authorization = headers.get("authorization");
  return authorization?.startsWith("Bearer ") === true;
}
