import "server-only";

import { resolveAdminReturnPath } from "@/lib/admin/admin-return-path.server";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { AdminSessionExpiredError } from "@/lib/data/http/admin-session-expired";
import { redirect } from "next/navigation";

/**
 * Runs a page load and, when the API reports the session has ended, sends the person to sign in
 * and back to the same page instead of showing the error page. Other errors pass through.
 */
export async function redirectIfSessionExpired<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof AdminSessionExpiredError) {
      redirect(buildHostedLoginStartHref({ next: await resolveAdminReturnPath() }));
    }
    throw error;
  }
}
