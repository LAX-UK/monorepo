export function isCaptchaRequiredPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const code = "code" in data ? data.code : undefined;
  return code === "captcha_required" || code === "captcha_invalid";
}

export function shouldRenderTurnstile(input: {
  captchaRequired: boolean;
  siteKey: string | null | undefined;
}): boolean {
  return Boolean(input.captchaRequired && input.siteKey);
}

export function submitEnabled(input: { captchaRequired: boolean; token: string }): boolean {
  if (!input.captchaRequired) return true;
  return input.token.length > 0;
}
