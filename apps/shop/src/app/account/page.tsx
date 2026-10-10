import { ShopAccountOverviewCards } from "@/components/account/shop-account-overview-cards";
import { ShopAccountLinkButton, ShopAccountShell } from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { laxAccountPortalHref } from "@/lib/lax-account-url";
import { shopIdentityUrl } from "@/lib/shop-identity.server";
import {
  resolveShopArtistPortalLinked,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Account");

function unverifiedEmailNotice(email: string) {
  return {
    variant: "warning" as const,
    title: "Verify your email address",
    description: (
      <div className="flex flex-col gap-3">
        <p>
          {email ? `Confirm ${email} ` : "Confirm your email "}
          so order confirmations, receipts and delivery updates reach you.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11">
            <a href={shopIdentityUrl("/auth/verify-email")}>Send verification email</a>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <a href={shopIdentityUrl("/auth/upgrade?returnTo=%2Faccount")}>I’ve verified it</a>
          </Button>
        </div>
      </div>
    ),
  };
}

type ShopAccountPageProps = {
  searchParams: Promise<{ returnTo?: string; merged?: string; basketMerge?: string }>;
};

export default async function ShopAccountPage({ searchParams }: ShopAccountPageProps) {
  const viewer = await loadShopViewerState();
  const params = await searchParams;

  if (viewer.kind === "unavailable") {
    return (
      <ShopAccountShell
        title={shopPageWayfinding.accountUnavailable.title}
        breadcrumbs={shopPageWayfinding.accountUnavailable.breadcrumbs}
        notice={{
          variant: "warning",
          title: "Could not verify sign-in",
          description: viewer.message,
        }}
      >
        <ShopAccountLinkButton href="/" label="Return home" variant="outline" />
      </ShopAccountShell>
    );
  }

  if (viewer.kind === "disabled") {
    redirect(viewer.accountHref ?? "/account/disabled");
  }

  if (viewer.kind === "guest") {
    const returnTo =
      typeof params.returnTo === "string" &&
      params.returnTo.startsWith("/") &&
      !params.returnTo.startsWith("//")
        ? params.returnTo
        : "/account";
    redirect(shopStorefrontLoginHref(returnTo));
  }

  const mergeComplete =
    params.merged === "1" ||
    params.basketMerge === "merged" ||
    params.basketMerge === "skipped" ||
    params.basketMerge === "failed";

  if (!mergeComplete) {
    const q = new URLSearchParams();
    const returnTo = params.returnTo;
    if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      q.set("returnTo", returnTo);
    }
    redirect(q.size > 0 ? `/account/post-sign-in?${q.toString()}` : "/account/post-sign-in");
  }

  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const artistPortalEnabled = await resolveShopArtistPortalLinked();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account",
    portalOwnershipEnabled,
    payoutsEnabled,
    artistPortalEnabled,
  };

  return (
    <ShopAccountShell
      title={shopPageWayfinding.account.title}
      breadcrumbs={shopPageWayfinding.account.breadcrumbs}
      {...shellNav}
      {...(viewer.emailVerified === false ? { notice: unverifiedEmailNotice(viewer.email) } : {})}
    >
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-on-surface-variant">Email</dt>
          <dd className="font-medium text-on-surface">{viewer.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Name</dt>
          <dd className="font-medium text-on-surface">{viewer.displayName || "—"}</dd>
        </div>
      </dl>
      {laxAccountPortalHref() ? (
        <p className="text-sm">
          <Link href={laxAccountPortalHref() ?? "/account"} className="text-primary underline">
            Manage your LAX account
          </Link>
          {" — profile, password, and two-step verification."}
        </p>
      ) : null}
      <ShopAccountOverviewCards
        portalOwnershipEnabled={portalOwnershipEnabled}
        payoutsEnabled={payoutsEnabled}
        artistPortalEnabled={artistPortalEnabled}
        activeHref="/account"
      />
      <form action={shopIdentityUrl("/logout")} method="post" className="pt-2">
        <Button type="submit" variant="secondaryOutline" className="min-h-11 w-full">
          Sign out
        </Button>
      </form>
    </ShopAccountShell>
  );
}
