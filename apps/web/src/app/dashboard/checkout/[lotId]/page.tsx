import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardErrorAlert, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { CheckoutLotMobileChrome } from "@/components/sections/checkout/checkout-lot-mobile-chrome";
import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import { LotCheckoutFulfilmentStrip } from "@/components/sections/checkout/lot-checkout-fulfilment-strip";
import { MediaImage } from "@/components/ui/media-image";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { buildCheckoutTotalsVm } from "@/lib/data/view-models/dashboard-checkout.vm";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ lotId: string }>;
};

export default async function DashboardCheckoutPage({ params }: PageProps) {
  const { lotId } = await params;
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/dashboard" });

  const c = await getServerDataContainer();
  const [lotR, fulfilmentR, addressesR] = await Promise.allSettled([
    c.buyerLots.getById(lotId),
    c.payments.getLotFulfilmentForWinner(lotId),
    c.addresses.listMine(),
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

  const checkoutPricing = auction.checkoutPricing;
  const hasPricing = checkoutPricing != null;
  const totalsVm = checkoutPricing ? buildCheckoutTotalsVm(checkoutPricing) : null;

  const img = auction.images[0];
  const premium = totalsVm?.premium ?? 0;
  const total = totalsVm?.total ?? 0;
  const premiumPercentLabel = totalsVm?.premiumPercentLabel ?? "";

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

        <div className="w-full flex-1 px-4 pb-[var(--page-bottom-padding)] pt-8 sm:px-6 lg:w-1/2 lg:px-16 lg:pb-20 lg:pt-16">
          <div className="mx-auto max-w-xl lg:mx-0">
            <DashboardDetailHeader
              title={auction.title}
              backHref="/dashboard/portfolio"
              backLabel="Back to collection"
              compactOnMobile
              sticky={false}
              className="mb-8 border-0 bg-transparent px-0 py-0 backdrop-blur-none lg:mb-10"
              description="Lot settled in your favor. Complete purchase below to open secure Stripe Checkout (card or UK bank transfer). High-value lots may require finance review before checkout is issued."
            />

            <DashboardSection id="checkout-flow" title="Invoice and payment">
              <div className="rounded-xl border border-border-hairline bg-surface-container-lowest/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
                {!hasPricing ? (
                  <DashboardErrorAlert
                    title="Could not load checkout pricing"
                    message="We could not load pricing for this lot. Refresh the page or contact support if this keeps happening."
                  >
                    <div className="flex flex-wrap gap-3">
                      <Button variant="secondary" asChild>
                        <Link href={`/dashboard/checkout/${lotId}`}>Retry</Link>
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
                    <nav
                      aria-label="Checkout steps"
                      className="mb-8 flex flex-wrap items-center gap-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                    >
                      <span className="rounded-full border border-primary/35 bg-primary-container/45 px-4 py-1.5 text-primary shadow-sm">
                        1 · Invoice
                      </span>
                      <span className="text-on-surface-variant/50" aria-hidden>
                        →
                      </span>
                      <span className="rounded-full border border-outline-variant/25 bg-surface-container-low px-4 py-1.5 text-on-surface-variant">
                        2 · Confirm
                      </span>
                    </nav>
                    {fulfilmentFailure ? (
                      <DashboardSliceErrorAlert failure={fulfilmentFailure} />
                    ) : null}
                    <LotCheckoutFulfilmentStrip fulfilment={fulfilment} lotId={auction.id} />

                    <CheckoutPurchasePanel
                      sessionUser={user}
                      lotId={auction.id}
                      hammer={formatMoney(auction.currentPrice)}
                      buyerPremium={formatMoney(premium.toFixed(2))}
                      total={formatMoney(total.toFixed(2))}
                      totalMinor={Math.round(total * 100)}
                      premiumPercentLabel={premiumPercentLabel}
                      addresses={addresses}
                    />
                  </>
                )}
              </div>
            </DashboardSection>

            <p className="mt-8 font-body text-sm text-on-surface-variant lg:mt-10">
              After payment, your lot moves to{" "}
              <Link
                href="/dashboard/portfolio"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Collection
              </Link>
              . Need help?{" "}
              <Link
                href={lotPath(auction)}
                className="rounded font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View full lot details
              </Link>
            </p>
            {addressesR.status === "rejected" ? (
              <div className="mt-4 rounded-lg border border-warning/40 bg-warning-container/15 p-4 text-sm text-on-surface">
                We could not load your saved addresses. You can still pay — add a shipping address
                during checkout if prompted.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasPricing ? (
        <CheckoutLotMobileChrome
          totalLabel={formatMoney(total.toFixed(2))}
          formId="checkout-purchase-form"
        />
      ) : null}
    </DashboardPage>
  );
}
