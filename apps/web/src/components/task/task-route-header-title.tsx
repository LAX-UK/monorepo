"use client";

import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  "/forgot-password": "Forgot password",
  "/login/two-factor": "Two-step verification",
  "/login": "Sign in",
  "/register": "Create account",
  "/register/verify-pending": "Verify email",
};

function resolveTaskRouteLabel(pathname: string): string | null {
  if (pathname.startsWith("/onboarding/organisation")) {
    return "Organisation onboarding";
  }

  for (const [path, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return label;
  }

  return null;
}

/** Center title for focused task routes (auth, onboarding). */
export function TaskRouteHeaderTitle() {
  const pathname = usePathname();
  const label = resolveTaskRouteLabel(pathname);

  if (!label) return null;

  return (
    <p className="min-w-0 truncate text-center font-label text-[0.65rem] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface sm:text-xs">
      {label}
    </p>
  );
}
