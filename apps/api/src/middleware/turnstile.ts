import { createMiddleware } from "hono/factory";
import { verifyTurnstileResponse } from "../lib/verify-turnstile.js";

type JsonWithTurnstile = { turnstileToken?: string | undefined };

/** When `TURNSTILE_SECRET_KEY` is set, require a valid `turnstileToken` on the validated JSON body. */
export function createTurnstileMiddleware(secret: string | undefined) {
  const trimmed = secret?.trim();
  return createMiddleware(async (c, next) => {
    if (!trimmed) {
      await next();
      return;
    }
    const json = (c as unknown as { req: { valid: (k: "json") => JsonWithTurnstile } }).req.valid(
      "json",
    );
    const token = typeof json.turnstileToken === "string" ? json.turnstileToken.trim() : "";
    if (!token) {
      return c.json({ error: "Captcha required", code: "captcha_required" }, 400);
    }
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      undefined;
    const ok = await verifyTurnstileResponse({
      secret: trimmed,
      token,
      remoteip: ip || undefined,
    });
    if (!ok) {
      return c.json({ error: "Captcha verification failed", code: "captcha_invalid" }, 403);
    }
    await next();
  });
}
