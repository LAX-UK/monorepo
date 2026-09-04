"use server";

import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { getPendingEntityInviteCookie } from "@/lib/legal-entity/pending-invite-cookie.server";

/** Build absolute verify-email callback URL including pending entity invite when present. */
export async function buildVerifyEmailResendCallbackUrl(
  email: string,
  next?: string | null,
  webOrigin?: string,
): Promise<string> {
  const origin = (
    webOrigin ??
    process.env.NEXT_PUBLIC_WEB_ORIGIN ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const params = new URLSearchParams({ email });
  const effectiveNext = next != null && next !== "" && isSafeNextPath(next) ? next : "/dashboard";
  params.set("next", effectiveNext);
  const invite = await getPendingEntityInviteCookie();
  if (invite) {
    params.set("invite", invite);
  }
  const verifiedPath = `/verify-email?${params.toString()}`;
  return `${origin}/api/auth/login?next=${encodeURIComponent(verifiedPath)}`;
}
