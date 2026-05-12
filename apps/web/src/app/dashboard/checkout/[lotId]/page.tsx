import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import { LotCheckoutFulfilmentStrip } from "@/components/sections/checkout/lot-checkout-fulfilment-strip";
import { MediaImage } from "@/components/ui/media-image";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerLotFulfilmentForWinner } from "@/lib/data/http/payments.server";
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

  const reader = await getServerLotReader();
  const auction = await reader.getById(lotId);
  if (!auction || auction.winnerId !== user.id) {
    redirect("/dashboard/portfolio");
  }

  const { premium, total, premiumPercentLabel } = buildCheckoutTotalsVm(
    auction.currentPrice,
    auction.buyerPremiumRate,
  );
  const addressRes = await authedServerFetch("/users/me/addresses");
  const addresses = addressRes.ok ? ((await addressRes.json()) as { data: unknown[] }).data : [];

  const fulfilment = await getServerLotFulfilmentForWinner(lotId).catch(() => null);

  const img = auction.images[0];

  return (
    <DashboardPage className="mx-auto max-w-[var(--container-inner,1376px)] space-y-0">
      <div className="mb-8 px-4 sm:px-0 lg:mb-10">
        <Link
          href="/dashboard/portfolio"
          className="inline-flex min-h-10 items-center gap-2 rounded-md font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>
            arrow_back
          </span>
          Back to collection
        </Link>
      </div>

      <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:flex-row">
        <div className="relative h-[50vh] w-full overflow-hidden bg-surface-container-low lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:max-w-none">
          <MediaImage
            src={img}
            alt={`${auction.title} — artwork for checkout`}
            label="Lot artwork"
            priority
            imgClassName="lg:object-contain"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>

        <div className="w-full flex-1 px-4 pb-28 pt-8 sm:px-6 lg:w-1/2 lg:px-16 lg:pb-20 lg:pt-16">
          <div className="mx-auto max-w-xl lg:mx-0">
            <h1 className="mb-3 font-headline text-3xl tracking-tight text-on-surface sm:text-4xl lg:text-5xl">
              {auction.title}
            </h1>
            <p className="mb-8 font-body text-sm leading-relaxed text-on-surface-variant lg:mb-10">
              Lot settled in your favor. You will be redirected to Xero-hosted checkout when an
              invoice is ready; until then you can refresh this page or return from your collection.
            </p>

            <section
              aria-labelledby="checkout-flow-heading"
              className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest/90 p-6 shadow-sm backdrop-blur-sm sm:p-8"
            >
              <h2 id="checkout-flow-heading" className="sr-only">
                Invoice and payment
              </h2>
              <nav
                aria-label="Checkout steps"
                className="mb-8 flex flex-wrap items-center gap-2 font-label text-xs font-semibold uppercase tracking-widest"
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
              <LotCheckoutFulfilmentStrip fulfilment={fulfilment} />

              <CheckoutPurchasePanel
                sessionUser={user}
                lotId={auction.id}
                hammer={formatMoney(auction.currentPrice)}
                buyerPremium={formatMoney(premium.toFixed(2))}
                total={formatMoney(total.toFixed(2))}
                premiumPercentLabel={premiumPercentLabel}
                addresses={addresses}
              />
            </section>

            <p className="mt-8 font-body text-xs text-on-surface-variant lg:mt-10">
              <Link
                href={lotPath(auction)}
                className="rounded font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View full lot details
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-outline-variant/15 bg-surface-container-lowest/95 px-4 py-3 shadow-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-surface-container-lowest/90 lg:hidden">
        <div>
          <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Total due
          </p>
          <p className="font-headline text-lg tabular-nums text-primary">
            {formatMoney(total.toFixed(2))}
          </p>
        </div>
        <Button
          variant="cta"
          asChild
          className="min-h-11 min-w-[10rem] font-label text-xs uppercase tracking-widest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Link href="#checkout-complete-purchase">Pay</Link>
        </Button>
      </div>
    </DashboardPage>
  );
}
