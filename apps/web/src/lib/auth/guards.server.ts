import "server-only";

import { resolveServerPostAuthDestination } from "@/lib/auth/post-auth-destination.server";
import { isRequireEmailVerificationServer } from "@/lib/auth/require-email-verification.server";
import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { isSellerSubmissionPath, sellLoginRedirect } from "@/lib/auth/seller-submission-path";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  type UserRole,
  canAccessStaffAdminShell,
  staffRoleDefaultDestination,
} from "@auction/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type AuthenticatedShell = "client" | "staff";

/** Ensures a valid session for protected areas. Handles stale edge cookie loop (`x-lax-auth-edge`).
 */
export async function requireAuthenticatedUser(opts: {
  shell: AuthenticatedShell;
  /** `next` query value for unauthenticated redirect to `/login`. */
  loginNext: string;
}): Promise<SessionUser> {
  const h = await headers();
  const fromAuthEdge = h.get("x-lax-auth-edge") === "1";

  const user = await getServerSessionUser();
  if (!user) {
    if (fromAuthEdge) {
      const params = new URLSearchParams({ session_expired: "1" });
      if (isSafeNextPath(opts.loginNext)) {
        params.set("next", opts.loginNext);
      }
      if (opts.shell === "client" && isSellerSubmissionPath(opts.loginNext)) {
        params.set("intent", "sell");
      }
      redirect(`/login?${params.toString()}`);
    }
    const isSellSubmission = opts.shell === "client" && isSellerSubmissionPath(opts.loginNext);
    redirect(
      isSellSubmission
        ? sellLoginRedirect(opts.loginNext)
        : `/login?next=${encodeURIComponent(opts.loginNext)}&auth=required`,
    );
  }

  if (user.suspended === true) {
    redirect("/account-suspended");
  }

  if (user.emailVerified !== true) {
    const params = new URLSearchParams();
    if (user.email) params.set("email", user.email);
    if (isSafeNextPath(opts.loginNext)) {
      params.set("next", opts.loginNext);
    }
    const qs = params.toString();
    redirect(qs ? `/register/verify-pending?${qs}` : "/register/verify-pending");
  }

  const role = user.role as UserRole;
  const staff = user.staffRole ?? null;

  if (
    opts.shell === "client" &&
    canAccessStaffAdminShell(role) &&
    !isSellerSubmissionPath(opts.loginNext)
  ) {
    const dest = staffRoleDefaultDestination(role, staff);
    const destPath = dest.split("?")[0] ?? dest;
    const loginPath = opts.loginNext.split("?")[0] ?? opts.loginNext;
    if (destPath !== loginPath) {
      redirect(dest);
    }
  }

  if (opts.shell === "staff" && !canAccessStaffAdminShell(role)) {
    redirect("/dashboard");
  }

  return user;
}

export type RedirectIfAuthenticatedRoute = "login" | "register" | "forgot-password";

/** `/register/verify-pending`: bounce verified sessions (contract: public auth guard family). */
export async function redirectIfVerifyPendingNotNeeded(): Promise<void> {
  const user = await getServerSessionUser();
  if (!user) return;
  if (user.suspended === true) {
    redirect("/account-suspended");
  }
  if (user.emailVerified === true) {
    redirect(
      resolveServerPostAuthDestination({
        user,
        requestedNext: null,
        context: "redirect-if-authed",
        requireEmailVerification: false,
        withWelcomeBack: true,
      }),
    );
  }
}

/** Marketing auth pages: bounce authenticated users to the appropriate home (unless bypass / email rules).
 */
export async function redirectIfAuthenticated(opts: {
  route: RedirectIfAuthenticatedRoute;
  next?: string | null;
  /** When true (e.g. `/login?switch=1`), do not redirect away. */
  bypass?: boolean;
}): Promise<void> {
  if (opts.bypass) return;

  const user = await getServerSessionUser();
  if (!user) return;

  if (user.suspended === true) {
    redirect("/account-suspended");
  }

  const requireEv = isRequireEmailVerificationServer();

  if (opts.route === "login") {
    if (requireEv && user.emailVerified !== true) {
      return;
    }
    redirect(
      resolveServerPostAuthDestination({
        user,
        requestedNext: opts.next ?? null,
        context: "redirect-if-authed",
        requireEmailVerification: false,
        withWelcomeBack: true,
      }),
    );
  }

  if (opts.route === "register") {
    redirect(
      resolveServerPostAuthDestination({
        user,
        requestedNext: opts.next ?? null,
        context: "redirect-if-authed",
        requireEmailVerification: requireEv,
        withWelcomeBack: true,
      }),
    );
  }

  if (opts.route === "forgot-password") {
    if (requireEv && user.emailVerified !== true) {
      return;
    }
    const role = user.role as UserRole;
    if (canAccessStaffAdminShell(role)) {
      redirect(
        resolveServerPostAuthDestination({
          user,
          requestedNext: null,
          context: "redirect-if-authed",
          requireEmailVerification: false,
          withWelcomeBack: true,
        }),
      );
    }
    redirect("/dashboard/settings/account?changePassword=1&welcome=back");
  }
}
