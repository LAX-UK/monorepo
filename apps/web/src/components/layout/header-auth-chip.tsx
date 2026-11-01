"use client";

import { AccountMenuIdentity } from "@/components/layout/account-menu/account-menu-identity";
import { HeaderAttentionChip } from "@/components/layout/header-attention-chip";
import { HeaderGuestMenu } from "@/components/layout/header-guest-menu";
import { HeaderUserMenu } from "@/components/layout/header-user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAppSession } from "@/lib/auth/use-app-session";
import { useAuthHeaderLinks } from "@/lib/auth/use-auth-header-links";
import type { SessionUser } from "@/lib/data/contracts";
import type { SiteHeaderTone } from "@/lib/layout/header-chrome-tone";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { LogoutButton } from "./logout-button";

type HeaderAuthChipVariant = "account" | "notifications" | "full";

type HeaderAuthChipProps = {
  variant?: HeaderAuthChipVariant;
  headerTone?: SiteHeaderTone;
  laxProductLinks?: LaxProductLinkVm[];
};

function HeaderAuthSkeleton({
  variant,
  headerTone = "on-light",
}: {
  variant: HeaderAuthChipVariant;
  headerTone?: SiteHeaderTone;
}) {
  const skeletonClass =
    headerTone === "on-dark"
      ? "size-11 rounded-full bg-white/20 motion-safe:animate-pulse"
      : "size-11 rounded-full bg-surface-container-high/70 motion-safe:animate-pulse";

  if (variant === "notifications") {
    return <div className={skeletonClass} aria-label="Loading account notifications" />;
  }

  return <div className={skeletonClass} aria-label="Loading account" aria-busy="true" />;
}

export function HeaderAuthChip({
  variant = "full",
  headerTone = "on-light",
  laxProductLinks = [],
}: HeaderAuthChipProps) {
  const { user, pending } = useAppSession();

  if (pending) return <HeaderAuthSkeleton variant={variant} headerTone={headerTone} />;
  if (!user) {
    return variant === "notifications" ? null : <HeaderGuestMenu headerTone={headerTone} />;
  }
  if (variant === "notifications") return <NotificationBell headerTone={headerTone} />;
  if (variant === "account") {
    return <HeaderUserMenu user={user} headerTone={headerTone} laxProductLinks={laxProductLinks} />;
  }

  return (
    <div className="flex items-center gap-2">
      <HeaderAttentionChip />
      <NotificationBell headerTone={headerTone} />
      <HeaderUserMenu user={user} headerTone={headerTone} laxProductLinks={laxProductLinks} />
    </div>
  );
}

function MobileGuestAuthSection({ onNavigate }: { onNavigate: () => void }) {
  const { signInHref, registerHref } = useAuthHeaderLinks();

  return (
    <div className="flex flex-col items-center gap-3 border-t border-nav-border pt-4">
      <Button variant="primary" className="w-full" asChild>
        <a href={registerHref} onClick={onNavigate}>
          Create account
        </a>
      </Button>
      <a
        href={signInHref}
        className={cn(
          "min-h-11 rounded-sm py-2 font-label text-sm font-medium text-brand-900 underline-offset-4 transition-colors hover:text-brand-800 hover:underline dark:text-on-surface dark:hover:text-on-surface-variant",
          FOCUS_RING,
        )}
        onClick={onNavigate}
      >
        Sign in
      </a>
    </div>
  );
}

export function MobileAuthSection({ onNavigate }: { onNavigate: () => void }) {
  const { user, pending } = useAppSession();

  if (pending) {
    return (
      <div className="flex flex-col gap-3 border-t border-nav-border pt-4" aria-busy="true">
        <div className="h-4 w-20 rounded bg-surface-container-high/70 motion-safe:animate-pulse" />
        <div className="h-11 rounded-md bg-surface-container-high/70 motion-safe:animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <MobileGuestAuthSection onNavigate={onNavigate} />;
  }

  return <MobileSignedInSection user={user} onNavigate={onNavigate} />;
}

/**
 * Signed in, the site menu only says who is signed in and offers Sign out: the account's own
 * pages open from the avatar, so the two menus never repeat each other.
 */
function MobileSignedInSection({
  user,
  onNavigate,
}: { user: SessionUser; onNavigate: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-t border-nav-border pt-4">
      <AccountMenuIdentity user={user} />
      <LogoutButton
        onBeforeNavigate={onNavigate}
        className="block w-full rounded-md border border-nav-border py-3 text-center font-label text-sm font-medium text-brand-900 transition-colors hover:bg-page-bg disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-hairline dark:text-on-surface dark:hover:bg-surface-container-low"
      />
    </div>
  );
}
