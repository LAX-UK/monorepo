import "server-only";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** True when an API answer is the staff step-up refusal (403 + `step_up_required`). */
export async function isStaffStepUpResponse(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const body = (await res.clone().json()) as { code?: unknown };
    return body.code === STAFF_STEP_UP_REQUIRED;
  } catch {
    return false;
  }
}

/** The page the action came from (Referer path and query, same origin only), else `fallbackPath`. */
export async function resolveStepUpReturnPath(fallbackPath: string): Promise<string> {
  const h = await headers();
  const referer = h.get("referer");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (referer && host) {
    try {
      const url = new URL(referer);
      if (url.host === host) {
        const path = `${url.pathname}${url.search}`;
        if (isSafeNextPath(path)) return path;
      }
    } catch {
      // A malformed Referer falls back to the caller's page.
    }
  }
  return fallbackPath;
}

/** Sends the person through hosted re-authentication and back to the page they were on. */
export async function redirectToStaffReauth(fallbackPath: string): Promise<never> {
  const next = await resolveStepUpReturnPath(fallbackPath);
  redirect(buildHostedLoginStartHref({ next, intent: "reauth" }));
}

/** For redirect-style server actions: leaves for re-authentication when the API asked for it. */
export async function redirectIfStaffStepUpRequired(
  res: Response,
  fallbackPath: string,
): Promise<void> {
  if (await isStaffStepUpResponse(res)) await redirectToStaffReauth(fallbackPath);
}
