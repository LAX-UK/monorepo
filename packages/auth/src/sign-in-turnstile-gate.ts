import { createHash } from "node:crypto";
import { verifyTurnstileResponse } from "./turnstile-siteverify.js";

const FAIL_THRESHOLD = 3;
const FAIL_TTL_SEC = 60 * 60;

export type SignInGateRedis = {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSec: number): Promise<number | undefined>;
  del(key: string): Promise<number>;
};

function authPathname(req: Request): string | null {
  try {
    return new URL(req.url).pathname;
  } catch {
    return null;
  }
}

export function isSignInEmailPost(req: Request): boolean {
  if (req.method !== "POST") return false;
  const pathname = authPathname(req);
  if (!pathname) return false;
  return pathname.endsWith("/sign-in/email") || pathname.includes("/sign-in/email");
}

export function isSignInMagicLinkPost(req: Request): boolean {
  if (req.method !== "POST") return false;
  const pathname = authPathname(req);
  if (!pathname) return false;
  return pathname.endsWith("/sign-in/magic-link") || pathname.includes("/sign-in/magic-link");
}

function failureKeyForEmail(email: string): string {
  const normalised = email.trim().toLowerCase();
  const h = createHash("sha256").update(normalised, "utf8").digest("hex");
  return `auth:signin-fail:${h}`;
}

function clientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  const xr = req.headers.get("x-real-ip")?.trim();
  return xr || undefined;
}

function stripTurnstileFromJsonBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && "turnstileToken" in parsed) {
      const { turnstileToken: _t, ...rest } = parsed;
      return JSON.stringify(rest);
    }
  } catch {
    return body;
  }
  return body;
}

/** After repeated failed email/password sign-ins, require Turnstile before forwarding to Better Auth. */
export async function runSignInTurnstileGate(opts: {
  incoming: Request;
  redis: SignInGateRedis;
  turnstileSecret?: string | undefined;
  authHandler: (req: Request) => Promise<Response>;
  onEmailPasswordSignInSuccess?: ((response: Response) => void | Promise<void>) | undefined;
}): Promise<Response> {
  const { incoming, redis, turnstileSecret, authHandler, onEmailPasswordSignInSuccess } = opts;

  const isEmailSignIn = isSignInEmailPost(incoming);
  const isMagicLinkSignIn = isSignInMagicLinkPost(incoming);
  if (!isEmailSignIn && !isMagicLinkSignIn) {
    return authHandler(incoming);
  }

  const secret = turnstileSecret?.trim();
  const rawBody = await incoming.text();
  let emailForKey: string | null = null;
  let turnstileToken: string | undefined;
  try {
    const j = JSON.parse(rawBody) as { email?: unknown; turnstileToken?: unknown };
    if (typeof j.email === "string") emailForKey = j.email;
    if (typeof j.turnstileToken === "string") turnstileToken = j.turnstileToken.trim();
  } catch {
    return authHandler(
      new Request(incoming.url, {
        method: incoming.method,
        headers: incoming.headers,
        body: rawBody,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
  }

  const forwardBody = stripTurnstileFromJsonBody(rawBody);
  const forwardReq = new Request(incoming.url, {
    method: incoming.method,
    headers: incoming.headers,
    body: forwardBody,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const requireTurnstileNow =
    Boolean(secret) && (isMagicLinkSignIn || (isEmailSignIn && emailForKey));

  if (requireTurnstileNow && secret) {
    const progressiveOnly = isEmailSignIn && !isMagicLinkSignIn;
    let needsCaptcha = !progressiveOnly;
    if (progressiveOnly && emailForKey) {
      const key = failureKeyForEmail(emailForKey);
      const n = Number.parseInt((await redis.get(key)) ?? "0", 10);
      needsCaptcha = n >= FAIL_THRESHOLD;
    }
    if (needsCaptcha) {
      if (!turnstileToken) {
        return jsonResponse(
          400,
          { error: "Captcha required", code: "captcha_required" },
          { "Cache-Control": "no-store" },
        );
      }
      const ok = await verifyTurnstileResponse({
        secret,
        token: turnstileToken,
        remoteip: clientIp(incoming),
      });
      if (!ok) {
        return jsonResponse(
          403,
          { error: "Captcha verification failed", code: "captcha_invalid" },
          { "Cache-Control": "no-store" },
        );
      }
    }
  }

  const res = await authHandler(forwardReq);

  if (emailForKey && isEmailSignIn) {
    const key = failureKeyForEmail(emailForKey);
    if (res.status === 401) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, FAIL_TTL_SEC);
    } else if (res.status >= 200 && res.status < 300) {
      await redis.del(key);
      if (onEmailPasswordSignInSuccess) await onEmailPasswordSignInSuccess(res);
    }
  }

  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  out.headers.set("Pragma", "no-cache");
  return out;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string>,
) {
  const h = new Headers({ "Content-Type": "application/json", ...extraHeaders });
  return new Response(JSON.stringify(body), { status, headers: h });
}
