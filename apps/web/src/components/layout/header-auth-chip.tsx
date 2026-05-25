"use client";

import { HeaderBidUrgencyChip } from "@/components/layout/header-bid-urgency-chip";
import { HeaderUserMenu } from "@/components/layout/header-user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAppSession } from "@/lib/auth/use-app-session";
import { cn } from "@auction/ui";
import Link from "next/link";
import { accountNavLinks } from "./header-account-nav";
import { LogoutButton } from "./logout-button";

type HeaderAuthChipVariant = "account" | "notifications" | "full";

const loginPillClassSolid =
  "inline-flex items-center justify-center rounded-full border border-brand-900 px-4 py-1.5 font-label text-sm font-medium uppercase leading-[21px] text-brand-900 transition-colors duration-300 hover:bg-brand-900 hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none dark:border-on-surface dark:text-on-surface dark:hover:bg-on-surface dark:hover:text-brand-900";

type HeaderAuthChipProps = {
  variant?: HeaderAuthChipVariant;
};

function HeaderAuthSkeleton({ variant }: { variant: HeaderAuthChipVariant }) {
  if (variant === "notifications") {
    return (
      <div
        className="size-11 rounded-full bg-surface-container-high/70 motion-safe:animate-pulse"
        aria-label="Loading account notifications"
      />
    );
  }

  return (
    <div className="flex items-center gap-2" aria-label="Loading account" aria-busy="true">
      {variant === "full" ? (
        <div className="size-11 rounded-full bg-surface-container-high/70 motion-safe:animate-pulse" />
      ) : null}
      <div className="size-9 rounded-full bg-surface-container-high/70 motion-safe:animate-pulse" />
      <div className="hidden h-9 w-36 rounded-full bg-surface-container-high/70 motion-safe:animate-pulse sm:block" />
    </div>
  );
}

function LoginPill() {
  return (
    <Link href="/login" className={loginPillClassSolid}>
      Log in
    </Link>
  );
}

export function HeaderAuthChip({ variant = "full" }: HeaderAuthChipProps) {
  const { user, pending } = useAppSession();

  if (pending) return <HeaderAuthSkeleton variant={variant} />;
  if (!user) {
    return variant === "notifications" ? null : <LoginPill />;
  }
  if (variant === "notifications") return <NotificationBell />;
  if (variant === "account") return <HeaderUserMenu user={user} />;

  return (
    <div className="flex items-center gap-2">
      <HeaderBidUrgencyChip />
      <NotificationBell />
      <HeaderUserMenu user={user} />
    </div>
  );
}

export function MobileAuthSection({ onNavigate }: { onNavigate: () => void }) {
  const { user, pending } = useAppSession();

  if (pending) {
    return (
      <div className="flex flex-col gap-3 border-t border-nav-border pt-4" aria-busy="true">
        <div className="h-4 w-20 rounded bg-surface-container-high/70 motion-safe:animate-pulse" />
        <div className="h-16 rounded-md bg-surface-container-high/70 motion-safe:animate-pulse" />
        <div className="h-11 rounded-md bg-surface-container-high/70 motion-safe:animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3 border-t border-nav-border pt-4">
        <Link
          href="/login"
          className="block w-full rounded-md border border-brand-900 bg-brand-900 py-3 text-center font-label text-sm font-medium uppercase tracking-wide text-surface transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none dark:border-on-surface dark:bg-on-surface dark:text-brand-900 dark:hover:bg-brand-200"
          onClick={onNavigate}
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-nav-border pt-4">
      <p className="font-label text-xs font-semibold uppercase tracking-wide text-brand-400 dark:text-on-surface-variant">
        Account
      </p>
      <div className="rounded-md border border-nav-border bg-page-bg px-3 py-2 dark:border-border-hairline dark:bg-surface-container-low">
        <p className="font-body text-sm font-medium text-brand-900 dark:text-on-surface">
          {user.name.trim() || "Signed in"}
        </p>
        <p className="mt-0.5 truncate font-body text-xs text-brand-400 dark:text-on-surface-variant">
          {user.email}
        </p>
      </div>
      <ul className="flex flex-col gap-0.5">
        {accountNavLinks(user).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "block py-2 font-label text-sm font-medium uppercase tracking-wide",
                "text-brand-900 transition-colors hover:text-brand-800 dark:text-on-surface",
              )}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <LogoutButton
        onBeforeNavigate={onNavigate}
        className="block w-full rounded-md border border-nav-border py-3 text-center font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:bg-page-bg disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-hairline dark:text-on-surface dark:hover:bg-surface-container-low"
      />
    </div>
  );
}
