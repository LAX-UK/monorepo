/** Client-visible Turnstile site key (optional). When unset, the API must not require captcha. */
export function turnstileSiteKey(): string | undefined {
  const k = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return k && k.length > 0 ? k : undefined;
}
