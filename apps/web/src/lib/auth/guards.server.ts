import "server-only";

import { resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { isRequireEmailVerificationServer } from "@/lib/auth/require-email-verification.server";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  type UserRole,
  canAccessPlatformAdminRoutes,
  canAccessStaffAdminShell,
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
      redirect("/login?session_expired=1");
    }
    redirect(`/login?next=${encodeURIComponent(opts.loginNext)}&auth=required`);
  }

  if (user.suspended === true) {
    redirect("/account-suspended");
  }

  if (user.emailVerified !== true) {
    const qs = new URLSearchParams({
      next: opts.loginNext,
      email: user.email,
    });
    redirect(`/register/verify-pending?${qs.toString()}`);
  }

  const role = user.role as UserRole;

  if (opts.shell === "client" && canAccessStaffAdminShell(role)) {
    redirect(canAccessPlatformAdminRoutes(role) ? "/admin" : "/admin/payments");
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
      resolvePostAuthDestination({
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
      resolvePostAuthDestination({
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
      resolvePostAuthDestination({
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
        resolvePostAuthDestination({
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
