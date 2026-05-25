/** Client-visible Turnstile site key (optional). When unset, the API must not require captcha. */
export function turnstileSiteKey(): string | undefined {
  const k = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (k && k.length > 0) return k;

  const secretConfigured =
    process.env.TURNSTILE_SECRET_KEY?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_REQUIRED === "1";
  if (secretConfigured && typeof console !== "undefined") {
    console.warn(
      "[auth] Turnstile is enabled on the API but NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset — captcha widgets will not render.",
    );
  }
  return undefined;
}
