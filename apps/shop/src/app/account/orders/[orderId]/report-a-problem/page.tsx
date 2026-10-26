import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopOrderProblemForm } from "@/components/account/shop-order-problem-form.client";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_POLICY_PATHS } from "@/content/policies/shop-policy-status";
import { SHOP_ORDERS_HREF, shopOrderHref } from "@/lib/account/shop-account-routes";
import { buildShopOrderProblem, shopOrderName } from "@/lib/account/shop-orders.vm";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";
import { fetchShopOrder } from "@/lib/shop-commerce.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { notFound, redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Report a problem");

type Props = { params: Promise<{ orderId: string }> };

export default async function ReportOrderProblemPage({ params }: Props) {
  const { orderId } = await params;
  const orderHref = shopOrderHref(orderId);
  const returnTo = `${orderHref}/report-a-problem`;
  const fallback = shopPageWayfinding.orderProblem("Order", orderHref);

  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, returnTo);
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={fallback.title}
        breadcrumbs={fallback.breadcrumbs}
        showAccountSettings={false}
      >
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order unavailable"
          titleAs="h2"
          description="We could not verify your session. Try again shortly."
          actions={<ShopCatalogueStateRetryButton />}
        />
      </ShopAccountShell>
    );
  }

  const result = await fetchShopOrder(orderId);
  if (result.status === "unauthorized") redirect(shopStorefrontLoginHref(returnTo));
  if (result.status === "empty") notFound();
  if (result.status === "failed") {
    return (
      <ShopAccountShell
        title={fallback.title}
        breadcrumbs={fallback.breadcrumbs}
        showAccountSettings={false}
      >
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order temporarily unavailable"
          titleAs="h2"
          description="We could not load this order. Try again in a moment."
          actions={
            <>
              <ShopCatalogueStateRetryButton />
              <ShopStatusStateLink href={SHOP_ORDERS_HREF}>Back to your orders</ShopStatusStateLink>
            </>
          }
        />
      </ShopAccountShell>
    );
  }

  const order = result.data;
  const orderName = shopOrderName(order);
  const wayfinding = shopPageWayfinding.orderProblem(orderName, orderHref);
  const problem = buildShopOrderProblem(order);
  const returnsHref = loadLinkableShopPolicies().includes("returns")
    ? SHOP_POLICY_PATHS.returns
    : null;

  return (
    <ShopAccountShell
      title={wayfinding.title}
      breadcrumbs={wayfinding.breadcrumbs}
      showAccountSettings={false}
    >
      {problem?.kind === "open" ? (
        <div className="shop-problem-page">
          <ShopOrderProblemForm
            orderId={order.orderId}
            orderName={orderName}
            orderHref={orderHref}
            until={problem.until}
            returnsHref={returnsHref}
          />
        </div>
      ) : (
        <ShopStatusState
          layout="page"
          variant="empty"
          icon="parcel"
          title="This order can no longer be reported here"
          titleAs="h2"
          description={
            problem?.kind === "closed" && problem.endedOn
              ? `The 14 days to cancel or report a problem with ${orderName} ended on ${problem.endedOn}. If something is wrong, contact us.`
              : `${orderName} cannot be reported here. If something is wrong, contact us.`
          }
          actions={
            <>
              <ShopStatusStateLink href={SHOP_POLICY_PATHS.help} priority="primary">
                Contact us
              </ShopStatusStateLink>
              <ShopStatusStateLink href={orderHref}>Back to your order</ShopStatusStateLink>
            </>
          }
        />
      )}
    </ShopAccountShell>
  );
}
