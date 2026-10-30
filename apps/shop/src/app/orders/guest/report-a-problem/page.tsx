import { ShopOrderProblemForm } from "@/components/account/shop-order-problem-form.client";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_POLICY_PATHS } from "@/content/policies/shop-policy-status";
import { buildShopOrderProblem, shopOrderName } from "@/lib/account/shop-orders.vm";
import { fetchCurrentGuestOrder } from "@/lib/checkout/guest-order.server";
import { GUEST_ORDER_PATH } from "@/lib/checkout/guest-order.vm";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Report a problem");

/**
 * "Report a problem" for a guest order, the same form and the same staff case as an account's,
 * reached through the order token the browser holds. No account is needed to get help.
 */
export default async function GuestOrderProblemPage() {
  const result = await fetchCurrentGuestOrder();
  if (result.status !== "ok" || result.view.state !== "valid") redirect(GUEST_ORDER_PATH);
  const order = result.view.order;
  const orderName = shopOrderName(order);
  const problem = buildShopOrderProblem(order);
  const returnsHref = loadLinkableShopPolicies().includes("returns")
    ? SHOP_POLICY_PATHS.returns
    : null;
  const header = {
    title: "Report a problem",
    breadcrumbs: [
      { label: "Shop", href: "/" },
      { label: orderName, href: GUEST_ORDER_PATH },
    ],
  };

  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--order">
      <ShopCommercePageShell header={header} contentClassName="shop-guest-order">
        {problem?.kind === "open" ? (
          <div className="shop-problem-page">
            <ShopOrderProblemForm
              orderId={order.orderId}
              orderName={orderName}
              orderHref={GUEST_ORDER_PATH}
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
                <ShopStatusStateLink href={GUEST_ORDER_PATH}>
                  Back to your order
                </ShopStatusStateLink>
              </>
            }
          />
        )}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
