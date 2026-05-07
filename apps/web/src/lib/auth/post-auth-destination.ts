import type { SessionUser } from "@/lib/data/contracts";
import type { UserRole } from "@auction/types";
import { canAccessPlatformAdminRoutes, canAccessStaffAdminShell } from "@auction/types";

export type PostAuthContext = "sign-in" | "sign-up" | "redirect-if-authed" | "verify-email-success";

export type ResolvePostAuthDestinationInput = {
  user: Pick<SessionUser, "role" | "suspended" | "emailVerified" | "email">;
  requestedNext?: string | null | undefined;
  context: PostAuthContext;
  /** When true, unverified users are sent to verify-pending for sign-up / redirect-if-authed contexts. */
  requireEmailVerification?: boolean;
  /** Append `welcome=back` to the destination query string. */
  withWelcomeBack?: boolean;
};

/** Same-origin relative paths only. Blocks open redirects (`//evil`, `https:`, `\`, `/api`, etc.).
 */
export function isSafeNextPath(next: string | null | undefined): boolean {
  if (next == null || next === "") return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next.includes("\\")) return false;
  const pathOnly = next.split("?")[0] ?? next;
  if (!pathOnly.startsWith("/")) return false;
  if (pathOnly.startsWith("/api")) return false;
  if (pathOnly.startsWith("/admin/api")) return false;
  return true;
}

export function roleDefaultDestination(role: UserRole): string {
  if (canAccessPlatformAdminRoutes(role)) return "/admin";
  if (canAccessStaffAdminShell(role)) return "/admin/payments";
  return "/dashboard";
}

function appendWelcomeBack(path: string, withWelcomeBack: boolean): string {
  if (!withWelcomeBack) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}welcome=back`;
}

/** Central post-auth navigation for web (server guards, middleware heuristic, client after sign-in).
 */
export function resolvePostAuthDestination(input: ResolvePostAuthDestinationInput): string {
  const {
    user,
    requestedNext,
    context,
    requireEmailVerification = false,
    withWelcomeBack = false,
  } = input;

  if (user.suspended === true) {
    return appendWelcomeBack("/account-suspended", withWelcomeBack);
  }

  const needsEmailGate =
    requireEmailVerification &&
    user.emailVerified !== true &&
    (context === "sign-up" || context === "redirect-if-authed");

  if (needsEmailGate) {
    const emailQ = encodeURIComponent(user.email ?? "");
    return appendWelcomeBack(`/register/verify-pending?email=${emailQ}`, withWelcomeBack);
  }

  if (isSafeNextPath(requestedNext ?? undefined)) {
    return appendWelcomeBack(requestedNext as string, withWelcomeBack);
  }

  const role = user.role as UserRole;
  return appendWelcomeBack(roleDefaultDestination(role), withWelcomeBack);
}
