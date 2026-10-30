import { ShopOrderDetail } from "@/components/account/shop-order-detail";
import { GuestAccountOffer } from "@/components/checkout/guest-account-offer";
import { GuestOrderLinkRequest } from "@/components/checkout/guest-order-link-request.client";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { fetchCurrentGuestOrder } from "@/lib/checkout/guest-order.server";
import {
  GUEST_LINK_PROBLEM_COPY,
  type GuestOrderLinkProblem,
  buildGuestOrderDetailVm,
  guestOrderLinkProblem,
} from "@/lib/checkout/guest-order.vm";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { MarketingDetailShell } from "@auction/marketing-ui";

export const metadata = shopPrivatePageTitle("Your order");

type GuestOrderPageProps = {
  searchParams: Promise<{ link?: string }>;
};

const fallback = shopPageWayfinding.guestOrder("Your order");

function GuestOrderShell({
  header,
  children,
}: {
  header: { title: string; breadcrumbs: readonly { label: string; href?: string }[] };
  children: React.ReactNode;
}) {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--order">
      <ShopCommercePageShell header={header} contentClassName="shop-guest-order">
        {children}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}

function LinkProblem({ problem }: { problem: GuestOrderLinkProblem }) {
  const copy = GUEST_LINK_PROBLEM_COPY[problem];
  if (problem === "claimed") {
    return (
      <ShopStatusState
        layout="page"
        variant="empty"
        icon="bag"
        title={copy.title}
        titleAs="h2"
        description={copy.description}
        actions={
          <ShopStatusStateLink href={shopStorefrontLoginHref(SHOP_ORDERS_HREF)} priority="primary">
            Sign in to see your orders
          </ShopStatusStateLink>
        }
      />
    );
  }
  return (
    <div className="shop-guest-order__problem">
      <ShopStatusState
        layout="inline"
        variant="empty"
        icon="bag"
        title={copy.title}
        titleAs="h2"
        description={copy.description}
      />
      <section className="shop-order-panel" aria-labelledby="guest-link-heading">
        <h2 id="guest-link-heading" className="shop-order-panel__title">
          Get a new link
        </h2>
        <GuestOrderLinkRequest />
      </section>
    </div>
  );
}

/**
 * A guest's order, opened from the link in their email or straight after paying, without an
 * account. The page reads the order through the token kept in an httpOnly cookie.
 */
export default async function GuestOrderPage({ searchParams }: GuestOrderPageProps) {
  const problem = guestOrderLinkProblem((await searchParams).link);
  if (problem) {
    return (
      <GuestOrderShell header={fallback}>
        <LinkProblem problem={problem} />
      </GuestOrderShell>
    );
  }

  const result = await fetchCurrentGuestOrder();
  if (result.status === "failed") {
    return (
      <GuestOrderShell header={fallback}>
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order temporarily unavailable"
          titleAs="h2"
          description="We could not load your order. Try again in a moment."
          actions={<ShopCatalogueStateRetryButton />}
        />
      </GuestOrderShell>
    );
  }
  if (result.status === "empty") {
    return (
      <GuestOrderShell header={fallback}>
        <LinkProblem problem="invalid" />
      </GuestOrderShell>
    );
  }
  const { view } = result;
  if (view.state !== "valid") {
    return (
      <GuestOrderShell header={fallback}>
        <LinkProblem problem={view.state} />
      </GuestOrderShell>
    );
  }

  const order = buildGuestOrderDetailVm(view.order, new Date());
  return (
    <GuestOrderShell header={shopPageWayfinding.guestOrder(order.title)}>
      <ShopOrderDetail order={order} />
      <GuestAccountOffer email={view.email} headingId="guest-order-account-heading" />
    </GuestOrderShell>
  );
}
