import { isSellerSubmissionPath } from "@/lib/auth/seller-submission-path";
import type { SessionUser } from "@/lib/data/contracts";
import {
  type UserRole,
  canAccessStaffAdminShell,
  staffRoleDefaultDestination,
} from "@auction/types";

export type PostAuthContext = "sign-in" | "sign-up" | "redirect-if-authed" | "verify-email-success";

export type ResolvePostAuthDestinationInput = {
  user: Pick<SessionUser, "role" | "staffRole" | "suspended" | "emailVerified" | "email">;
  requestedNext?: string | null | undefined;
  context: PostAuthContext;
  /** When true, unverified users are sent to verify-pending for sign-up / redirect-if-authed contexts. */
  requireEmailVerification?: boolean;
  /** Append `welcome=back` to the destination query string. */
  withWelcomeBack?: boolean;
};

/** Same-origin relative paths only. Blocks open redirects (`//evil`, `https:`, `\`, `/api`, etc.).
 * Rejects URL-encoded variants (e.g. `/%2F%2Fevil.com` → `///evil.com`).
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
  const blockedPrefixes = [
    "/login",
    "/register",
    "/account-suspended",
    "/forgot-password",
    "/reset-password",
    "/auth/",
  ];
  for (const prefix of blockedPrefixes) {
    if (pathOnly === prefix.replace(/\/$/, "") || pathOnly.startsWith(prefix)) return false;
  }
  try {
    const decoded = decodeURIComponent(pathOnly);
    if (decoded.includes("//")) return false;
    if (decoded.includes("\\")) return false;
  } catch {
    return false;
  }
  return true;
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
    const q = new URLSearchParams();
    if (isSafeNextPath(requestedNext ?? undefined)) {
      q.set("next", requestedNext as string);
    }
    const qs = q.toString();
    return appendWelcomeBack(
      qs ? `/register/verify-pending?${qs}` : "/register/verify-pending",
      withWelcomeBack,
    );
  }

  const role = user.role as UserRole;
  const isStaff = canAccessStaffAdminShell(role);
  const requestedIsClientHome =
    requestedNext === "/dashboard" || (requestedNext?.startsWith("/dashboard/") ?? false);
  const requestedIsSellerSubmission =
    requestedNext != null && isSellerSubmissionPath(requestedNext);

  if (
    isSafeNextPath(requestedNext ?? undefined) &&
    !(isStaff && requestedIsClientHome && !requestedIsSellerSubmission)
  ) {
    return appendWelcomeBack(requestedNext as string, withWelcomeBack);
  }

  return appendWelcomeBack(
    staffRoleDefaultDestination(role, user.staffRole ?? null),
    withWelcomeBack,
  );
}
