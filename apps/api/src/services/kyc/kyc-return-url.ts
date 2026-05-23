/** Veriff requires HTTPS callback URLs (error 1302 otherwise). */
export function normalizeKycReturnUrl(returnUrl: string, webOrigin: string | undefined): string {
  const trustedOrigin = webOrigin?.replace(/\/$/, "");
  if (!trustedOrigin) return returnUrl;

  try {
    const parsed = new URL(returnUrl);
    const trusted = new URL(trustedOrigin);
    if (parsed.protocol === "https:") return returnUrl;
    if (trusted.protocol !== "https:") return returnUrl;
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, trusted).toString();
  } catch {
    return returnUrl;
  }
}

export function assertHttpsReturnUrl(returnUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    throw new Error("kyc_return_url_invalid");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("kyc_return_url_must_be_https");
  }
}
