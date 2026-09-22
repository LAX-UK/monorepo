import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { shopIdentityUrl } from "@/lib/shop-identity.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { Button } from "@auction/ui/components/button";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

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
    return (
      <ShopAccountShell
        title={shopPageWayfinding.accountSignIn.title}
        breadcrumbs={shopPageWayfinding.accountSignIn.breadcrumbs}
        notice={{
          variant: "default",
          title: "Shop account",
          description: "Start sign-in through the Shop Identity boundary.",
        }}
      >
        <ShopAccountBodyText>
          Use your LAX credentials to view orders and manage your shop account.
        </ShopAccountBodyText>
        <ShopAccountLinkButton
          href={shopStorefrontLoginHref(returnTo)}
          label="Continue to sign in"
        />
      </ShopAccountShell>
    );
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

  return (
    <ShopAccountShell
      title={shopPageWayfinding.account.title}
      breadcrumbs={shopPageWayfinding.account.breadcrumbs}
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
      <ShopAccountLinkButton href="/account/orders" label="View orders" variant="outline" />
      <form action={shopIdentityUrl("/logout")} method="post" className="pt-2">
        <Button type="submit" variant="secondaryOutline" className="min-h-11 w-full">
          Sign out
        </Button>
      </form>
    </ShopAccountShell>
  );
}
