import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardErrorAlert, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import { CheckoutReturnBanner } from "@/components/sections/checkout/checkout-return-banner";
import { LotCheckoutFulfilmentStrip } from "@/components/sections/checkout/lot-checkout-fulfilment-strip";
import { MediaImage } from "@/components/ui/media-image";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveCheckoutPagePaymentState } from "@/lib/checkout/checkout-page-state";
import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerBuyerComplianceGate } from "@/lib/data/http/payments.server";
import { buildCheckoutTotalsVm } from "@/lib/data/view-models/dashboard-checkout.vm";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

type PageProps = {
  params: Promise<{ lotId: string }>;
};

const lotIdSchema = z.string().uuid();

export default async function DashboardCheckoutPage({ params }: PageProps) {
  const { lotId: rawLotId } = await params;
  const parsedLotId = lotIdSchema.safeParse(rawLotId);
  if (!parsedLotId.success) {
    notFound();
  }
  const lotId = parsedLotId.data;

  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/dashboard" });

  const c = await getServerDataContainer();
  const [lotR, fulfilmentR, addressesR, paymentsR, complianceGateR] = await Promise.allSettled([
    c.buyerLots.getById(lotId),
    c.payments.getLotFulfilmentForWinner(lotId),
    c.addresses.listMine(),
    c.payments.listMine(),
    getServerBuyerComplianceGate(),
  ]);
  if (lotR.status === "rejected") {
    throw lotR.reason;
  }
  const auction = lotR.value;
  if (!auction || auction.winnerId !== user.id) {
    redirect("/dashboard/portfolio?notice=not-winner");
  }

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

  const checkoutPricing = auction.checkoutPricing;
  const hasPricing = checkoutPricing != null;
  const totalsVm = checkoutPricing ? buildCheckoutTotalsVm(checkoutPricing) : null;

  const img = auction.images[0];
  const hammerLabel = totalsVm ? formatMoney(totalsVm.hammer.toFixed(2)) : "";
  const premium = totalsVm?.premium ?? 0;
  const total = totalsVm?.total ?? 0;
  const premiumPercentLabel = totalsVm?.premiumPercentLabel ?? "";
  const totalLabel = formatMoney(total.toFixed(2));

  return (
    <DashboardPage className="mx-auto max-w-[var(--container-inner,1376px)] space-y-0">
      <SetMobileShellTitle title={auction.title} />
      <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:flex-row">
        <div className="relative h-[30vh] w-full overflow-hidden bg-surface-container-low sm:h-[40vh] lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:max-w-none">
          <MediaImage
            src={img}
            alt={`${auction.title} — artwork for checkout`}
            label="Lot artwork"
            priority
            imgClassName="lg:object-contain"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>

        <div className="min-w-0 w-full flex-1 overflow-x-hidden px-4 pb-[var(--page-bottom-padding)] pt-8 sm:px-6 lg:w-1/2 lg:px-16 lg:pb-20 lg:pt-16">
          <div className="mx-auto min-w-0 max-w-xl lg:mx-0">
            <DashboardDetailHeader
              title={auction.title}
              backHref="/dashboard/portfolio"
              backLabel="Back to collection"
              compactOnMobile
              sticky={false}
              className="mb-8 border-0 bg-transparent px-0 py-0 backdrop-blur-none lg:mb-10"
              description="Lot settled in your favor. Review your invoice and complete payment below (card or UK bank transfer via Stripe). High-value lots may require finance review first."
            />

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
                      <Button variant="outline" asChild>
                        <Link
                          href={`mailto:${process.env.NEXT_PUBLIC_SETTLEMENTS_EMAIL?.trim() || "settlements@example.com"}`}
                        >
                          Contact support
                        </Link>
                      </Button>
                    </div>
                  </DashboardErrorAlert>
                ) : (
                  <>
                    <p className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                      Review invoice and pay
                    </p>
                    {fulfilmentFailure ? (
                      <DashboardSliceErrorAlert failure={fulfilmentFailure} />
                    ) : null}
                    {paymentsFailure ? (
                      <DashboardSliceErrorAlert failure={paymentsFailure} />
                    ) : null}
                    <LotCheckoutFulfilmentStrip fulfilment={fulfilment} lotId={auction.id} />

                    <CheckoutPurchasePanel
                      sessionUser={user}
                      lotId={auction.id}
                      lotTitle={auction.title}
                      hammer={hammerLabel}
                      buyerPremium={formatMoney(premium.toFixed(2))}
                      total={totalLabel}
                      totalMinor={Math.round(total * 100)}
                      premiumPercentLabel={premiumPercentLabel}
                      addresses={addresses}
                      paymentComplete={paymentComplete}
                      openPaymentStatus={openPayment?.status ?? null}
                      openPaymentManualReviewReason={openPayment?.manualReviewReason ?? null}
                      paymentsLoadFailed={paymentsFailure != null}
                      preflightComplianceGate={complianceGate}
                    />
                  </>
                )}
              </div>
            </DashboardSection>

            <p className="mt-8 font-body text-sm text-on-surface-variant lg:mt-10">
              After payment, your lot moves to{" "}
              <Link
                href="/dashboard/portfolio"
                className="font-medium text-link underline-offset-4 hover:underline"
              >
                Collection
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
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
