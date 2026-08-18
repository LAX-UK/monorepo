import { isSafeNextPath } from "@/lib/auth/post-auth-destination";

/**
 * Better Auth resolves relative `callbackURL` against the auth issuer (e.g.
 * test-auth.lax.bid), which has no Next.js `/verify-email` page — always use
 * the web app's absolute origin for post-verification redirects.
 */
export function buildVerifyEmailCallbackUrl(email: string, next?: string | null): string {
  if (typeof window === "undefined") {
    throw new Error("buildVerifyEmailCallbackUrl is client-only");
  }
  const origin = window.location.origin.replace(/\/$/, "");
  const nextQs =
    next != null && next !== "" && isSafeNextPath(next) ? `&next=${encodeURIComponent(next)}` : "";
  const verifiedPath = `/verify-email?email=${encodeURIComponent(email)}${nextQs}`;
  return `${origin}/api/auth/login?next=${encodeURIComponent(verifiedPath)}`;
}
