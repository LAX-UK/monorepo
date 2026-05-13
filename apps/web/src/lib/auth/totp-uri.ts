/** Extract TOTP secret param from an `otpauth://` URI for manual entry. */
export function parseTotpSecretFromUri(totpURI: string): string | null {
  try {
    const u = new URL(totpURI);
    return u.searchParams.get("secret");
  } catch {
    return null;
  }
}
