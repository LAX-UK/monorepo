"use client";

import { useAppSession } from "@/lib/auth/use-app-session";
import { useAuthHeaderLinks } from "@/lib/auth/use-auth-header-links";
import type { SiteHeaderTone } from "@/lib/layout/header-chrome-tone";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { MarketingAccountEntry } from "@auction/marketing-ui/marketing-account-entry";
import { cn } from "@auction/ui/lib/utils";
import dynamic from "next/dynamic";

type BidHeaderAccountProps = {
  headerTone?: SiteHeaderTone;
  laxProductLinks?: LaxProductLinkVm[];
};

/**
 * The signed-in account control (avatar, menu, account sheet) is its own chunk, fetched only for
 * a signed-in visitor. The server draws the same markup, so the page does not change when it
 * arrives.
 */
function AccountPlaceholder({ headerTone }: { headerTone: SiteHeaderTone }) {
  return (
    <div
      role="status"
      aria-label="Loading account"
      aria-busy="true"
      className={cn(
        "size-11 rounded-full motion-safe:animate-pulse",
        headerTone === "on-dark" ? "bg-white/20" : "bg-surface-container-high/70",
      )}
    />
  );
}

const SignedInAccount = dynamic(
  () =>
    import("@/components/layout/bid-header-signed-in-account").then((mod) => ({
      default: mod.SignedInAccount,
    })),
  // Only seen when someone signs in without the page reloading; the server draws the real one.
  { loading: () => <AccountPlaceholder headerTone="on-light" /> },
);

/**
 * The header's one account control: "Account" with Sign in and Create account when signed out,
 * the avatar and first name when signed in. Notifications are reached from the account menu.
 */
export function BidHeaderAccount({
  headerTone = "on-light",
  laxProductLinks = [],
}: BidHeaderAccountProps) {
  const { user, pending } = useAppSession();
  const { signInHref, registerHref } = useAuthHeaderLinks();

  if (pending) return <AccountPlaceholder headerTone={headerTone} />;
  if (!user) {
    return (
      <MarketingAccountEntry
        viewer={null}
        signInHref={signInHref}
        createAccountHref={registerHref}
        headerTone={headerTone}
      />
    );
  }
  return <SignedInAccount user={user} headerTone={headerTone} laxProductLinks={laxProductLinks} />;
}
