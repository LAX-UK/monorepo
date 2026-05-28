"use client";

import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  "/forgot-password": "Forgot password",
  "/login/two-factor": "Two-step verification",
  "/login": "Sign in",
  "/register": "Create account",
  "/register/verify-pending": "Verify email",
};

const ONBOARDING_STEP_LABELS: Record<string, string> = {
  type: "Organisation type",
  details: "Organisation details",
  documents: "Documents",
  connect: "Connect payouts",
  identity: "Identity verification",
};

function resolveTaskRouteLabel(pathname: string): string | null {
  if (pathname.startsWith("/onboarding/organisation")) {
    const step = pathname.match(/\/step\/([^/]+)/)?.[1];
    if (step && ONBOARDING_STEP_LABELS[step]) return ONBOARDING_STEP_LABELS[step];
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
    <p className="pointer-events-none absolute left-1/2 top-1/2 max-w-[min(100%,12rem)] -translate-x-1/2 -translate-y-1/2 truncate text-center font-label text-[0.65rem] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface sm:max-w-none sm:text-xs">
      {label}
    </p>
  );
}
