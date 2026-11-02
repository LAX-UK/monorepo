import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardErrorAlert, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import { CheckoutReadinessStrip } from "@/components/sections/checkout/checkout-readiness-strip";
import { CheckoutReturnBanner } from "@/components/sections/checkout/checkout-return-banner";
import { LotCheckoutFulfilmentStrip } from "@/components/sections/checkout/lot-checkout-fulfilment-strip";
import { OrganisationPaysBlock } from "@/components/sections/checkout/status/organisation-pays-block";
import { MediaImage } from "@/components/ui/media-image";
import { organisationOf } from "@/lib/account-scope/account-scope";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { paymentRoleFor } from "@/lib/buying/account-buying-figures";
import { resolveCheckoutPagePaymentState } from "@/lib/checkout/checkout-page-state";
import { settlementsEmail } from "@/lib/checkout/settlements-contact";
import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  getServerBuyerComplianceGate,
  getServerEntityPayments,
} from "@/lib/data/http/payments.server";
import { buildCheckoutTotalsVm } from "@/lib/data/view-models/dashboard-checkout.vm";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";
import { checkoutIntro } from "@/lib/purchases/checkout-intro";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import { Button } from "@auction/ui/lax";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { z } from "zod";

type PageProps = {
  params: Promise<{ lotId: string }>;
  searchParams: Promise<{ payment?: string }>;
};

const lotIdSchema = z.string().uuid();

/** What the invoice step says, naming the organisation when paying for one. */
export default async function DashboardCheckoutPage({ params, searchParams }: PageProps) {
  const { lotId: rawLotId } = await params;
  const { payment: paymentReturn } = await searchParams;
  const parsedLotId = lotIdSchema.safeParse(rawLotId);
  if (!parsedLotId.success) {
    notFound();
  }
  const lotId = parsedLotId.data;

  const checkoutPath = `/purchases/checkout/${lotId}`;
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: checkoutPath });
  const c = await getServerDataContainer();
  const scope = await c.buying.scope();
  // A purchase is paid from the account it was won as; a link opened in another one switches.
  await openRecordInItsAccount({
    kind: "purchase",
    id: lotId,
    actingId: scope.account.id,
    next: checkoutPath,
  });
  const organisation = organisationOf(scope);

  const lot = await c.buyerLots.getById(lotId);
  const role = lot ? paymentRoleFor(scope, { lot }) : "none";
  if (!lot || role === "none") {
    redirect("/purchases?notice=not-winner");
  }
  if (role === "informed") {
    // The member who won is told how payment is going; the organisation's payers pay.
    const purchase = (await c.buying.purchases().catch(() => [])).find(
      (row) => row.lot.id === lotId,
    );
    return (
      <CheckoutLayout lot={lot}>
        <OrganisationPaysBlock
          payer={organisation?.name ?? "your organisation"}
          paid={purchase?.payment?.status === "captured"}
        />
      </CheckoutLayout>
    );
  }

  const [fulfilmentR, addressesR, paymentsR, complianceGateR] = await Promise.allSettled([
    c.payments.getLotFulfilmentForWinner(lotId),
    c.addresses.listMine(),
    // An organisation's payment may have been started by any of its payers.
    organisation ? getServerEntityPayments() : c.payments.listMine(),
    getServerBuyerComplianceGate(),
  ]);
  const auction = lot;

  const fulfilment = fulfilmentR.status === "fulfilled" ? fulfilmentR.value : null;
  const fulfilmentFailure =
    fulfilmentR.status === "rejected"
      ? describeDashboardSliceFailure(
          fulfilmentR.reason,
          "checkout",
          "Could not load fulfilment status for this lot.",
        )
      : null;
  const addresses = addressesR.status === "fulfilled" ? addressesR.value : [];
  const myPayments = paymentsR.status === "fulfilled" ? paymentsR.value : [];
  const paymentsFailure =
    paymentsR.status === "rejected"
      ? describeDashboardSliceFailure(
          paymentsR.reason,
          "checkout",
          "Could not load your payment history for this lot.",
        )
      : null;
  const complianceGate = complianceGateR.status === "fulfilled" ? complianceGateR.value : "clear";
  const { paymentComplete, openPayment } = resolveCheckoutPagePaymentState(
    myPayments,
    lotId,
    fulfilment,
  );
  const stripeReturnSuccess = paymentReturn === "success";

  const lotCheckoutPricing = auction.checkoutPricing;
  const hasPricing = lotCheckoutPricing != null;
  const totalsVm = lotCheckoutPricing ? buildCheckoutTotalsVm(lotCheckoutPricing) : null;

  const hammerLabel = totalsVm
    ? formatMoney(totalsVm.hammer.toFixed(2), PLATFORM_DEFAULT_CURRENCY)
    : "";
  const premium = totalsVm?.premium ?? 0;
  const total = totalsVm?.total ?? 0;
  const premiumPercentLabel = totalsVm?.premiumPercentLabel ?? "";
  const totalLabel = formatMoney(total.toFixed(2), PLATFORM_DEFAULT_CURRENCY);
  const buyerPremiumLabel = formatMoney(premium.toFixed(2), PLATFORM_DEFAULT_CURRENCY);

  const checkoutOrderSummary = {
    hammer: hammerLabel,
    buyerPremium: buyerPremiumLabel,
    total: totalLabel,
    premiumPercentLabel,
  };
  const panelPricing = {
    totalMinor: Math.round(total * 100),
    currency: PLATFORM_DEFAULT_CURRENCY,
  };
  const checkoutPaymentLifecycle = {
    paymentComplete,
    openPaymentStatus: openPayment?.status ?? null,
    openPaymentManualReviewReason: openPayment?.manualReviewReason ?? null,
    openPaymentCheckoutRail: openPayment?.checkoutRail ?? null,
    paymentsLoadFailed: paymentsFailure != null,
    preflightComplianceGate: complianceGate,
    stripeReturnSuccess,
  };

  return (
    <>
      <CheckoutReadinessStrip />
      <CheckoutLayout
        lot={auction}
        description={checkoutIntro({
          organisationName: organisation?.name ?? null,
          paymentComplete,
          openPaymentStatus: openPayment?.status ?? null,
          openPaymentReviewReason: openPayment?.manualReviewReason ?? null,
          complianceGate,
        })}
      >
        <Suspense fallback={null}>
          <CheckoutReturnBanner lotTitle={auction.title} />
        </Suspense>

        <DashboardSection id="checkout-flow" title="Invoice and payment">
          <div className="min-w-0 space-y-6">
            {!hasPricing ? (
              <DashboardErrorAlert
                title="Could not load checkout pricing"
                message="We could not load pricing for this lot. Refresh the page or contact support if this keeps happening."
              >
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" asChild>
                    <Link href={dashboardCheckoutLotUrl(lotId)}>Retry</Link>
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link href={settlementsEmail() ? `mailto:${settlementsEmail()}` : "/purchases"}>
                      Contact support
                    </Link>
                  </Button>
                </div>
              </DashboardErrorAlert>
            ) : (
              <>
                {fulfilmentFailure ? (
                  <DashboardSliceErrorAlert failure={fulfilmentFailure} />
                ) : null}
                {paymentsFailure ? <DashboardSliceErrorAlert failure={paymentsFailure} /> : null}
                <LotCheckoutFulfilmentStrip fulfilment={fulfilment} lotId={auction.id} />

                <CheckoutPurchasePanel
                  sessionUser={user}
                  lotId={auction.id}
                  lotTitle={auction.title}
                  addresses={addresses}
                  payingFor={organisation?.name ?? null}
                  {...checkoutOrderSummary}
                  {...panelPricing}
                  {...checkoutPaymentLifecycle}
                />
              </>
            )}
          </div>
        </DashboardSection>

        <p className="mt-8 font-body text-sm text-on-surface-variant lg:mt-10">
          After payment, follow delivery in{" "}
          <Link
            href="/purchases"
            className="font-medium text-link underline-offset-4 hover:underline"
          >
            Purchases
          </Link>
          . Need help?{" "}
          <Link
            href={lotPath(auction)}
            className="rounded font-medium text-link underline-offset-4 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View full lot details
          </Link>
        </p>
        {addressesR.status === "rejected" ? (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning-container/15 p-4 text-sm text-on-surface">
            We could not load your saved addresses. Add a shipping address in settings before
            checkout.
          </div>
        ) : null}
      </CheckoutLayout>
    </>
  );
}

type CheckoutLayoutProps = {
  lot: Pick<Lot, "title" | "images">;
  /** One line under the title; omitted when the step below speaks for itself. */
  description?: string;
  children: ReactNode;
};

/** The artwork on one side and the checkout step on the other, as every checkout shows it. */
function CheckoutLayout({ lot, description, children }: CheckoutLayoutProps) {
  return (
    <DashboardPage className="mx-auto max-w-[var(--container-inner,1376px)] space-y-0">
      <SetMobileShellTitle title={lot.title} />
      <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:flex-row">
        <div className="relative h-[30vh] w-full overflow-hidden bg-surface-container-low sm:h-[40vh] lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:max-w-none">
          <MediaImage
            src={lot.images[0]}
            alt={`${lot.title} — artwork for checkout`}
            label="Lot artwork"
            priority
            imgClassName="object-contain"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>

        <div className="min-w-0 w-full flex-1 overflow-x-hidden px-4 pb-[var(--page-bottom-padding)] pt-8 sm:px-6 lg:w-1/2 lg:px-16 lg:pb-20 lg:pt-16">
          <div className="mx-auto min-w-0 max-w-xl lg:mx-0">
            <DashboardDetailHeader
              title={lot.title}
              backHref="/purchases"
              backLabel="Back to purchases"
              compactOnMobile
              sticky={false}
              className="mb-8 border-0 bg-transparent px-0 py-0 backdrop-blur-none lg:mb-10"
              {...(description ? { description } : {})}
            />
            {children}
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
