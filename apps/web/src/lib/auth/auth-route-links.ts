import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { z } from "zod";

export type AuthRoutePath = "/login" | "/register" | "/forgot-password";

type BuildAuthHrefOptions = {
  next?: string | null;
  email?: string | null;
};

const emailParamSchema = z.string().email();

/** Builds auth route hrefs with safe `next` and optional prefill `email`. */
export function buildAuthHref(path: AuthRoutePath, options: BuildAuthHrefOptions = {}): string {
  const params = new URLSearchParams();
  if (options.next && isSafeNextPath(options.next)) {
    params.set("next", options.next);
  }
  const email = options.email?.trim();
  if (email && emailParamSchema.safeParse(email).success) {
    params.set("email", email);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Reads a validated email prefill from forgot-password query params. */
export function parseAuthEmailParam(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const parsed = emailParamSchema.safeParse(raw.trim());
  return parsed.success ? parsed.data : undefined;
}
