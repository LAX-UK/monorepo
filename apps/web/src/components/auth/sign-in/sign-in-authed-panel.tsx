"use client";

import { LogoutButton } from "@/components/layout/logout-button";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import type { SessionUser } from "@/lib/data/contracts";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type SignInAuthedPanelProps = {
  user: SessionUser;
  next: string;
  switchAccount?: boolean;
  safeNext?: string | undefined;
};

export function SignInAuthedPanel({
  user,
  next,
  switchAccount = false,
  safeNext,
}: SignInAuthedPanelProps) {
  const dest = resolvePostAuthDestination({
    user: {
      email: user.email,
      role: user.role,
      staffRole: user.staffRole ?? null,
      emailVerified: user.emailVerified ?? false,
      suspended: user.suspended ?? false,
    },
    requestedNext: next,
    context: "redirect-if-authed",
    requireEmailVerification: false,
    withWelcomeBack: true,
  });

  return (
    <div className="flex w-full flex-col gap-8">
      <output
        className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
        aria-live="polite"
      >
        {switchAccount ? (
          <>
            You&apos;re signed in as{" "}
            <span className="font-medium text-on-surface">{user.email}</span>. Sign out to use a
            different account, or continue to your dashboard.
          </>
        ) : (
          <>
            You&apos;re already signed in as{" "}
            <span className="font-medium text-on-surface">{user.email}</span>.
          </>
        )}
      </output>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          asChild
          variant="cta"
          size="lg"
          className="font-label uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
        >
          <Link href={dest}>{switchAccount ? "Continue to dashboard" : "Continue"}</Link>
        </Button>
        <LogoutButton className="min-h-11 rounded-md border border-outline-variant/30 px-4 py-2 text-center font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-high" />
      </div>
      {!switchAccount && safeNext ? (
        <p className="text-center font-footer-links text-xs text-on-surface-variant">
          <Link href={`/login?switch=1&next=${encodeURIComponent(next)}`} className="underline">
            Use a different account
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export function SignInAuthedLoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />;
}
