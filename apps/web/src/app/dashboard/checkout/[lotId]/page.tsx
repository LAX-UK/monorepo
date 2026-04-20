import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ lotId: string }>;
};

function totalsFromLot(currentPrice: string, buyerPremiumRate: string) {
  const hammer = Number.parseFloat(currentPrice);
  const rate = Number.parseFloat(buyerPremiumRate);
  const safeHammer = Number.isFinite(hammer) ? hammer : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const premium = safeHammer * safeRate;
  const total = safeHammer + premium;
  return { hammer: safeHammer, premium, total, rate: safeRate };
}

export default async function DashboardCheckoutPage({ params }: PageProps) {
  const { lotId } = await params;
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard&auth=required");
  }

  const reader = await getServerLotReader();
  const auction = await reader.getById(lotId);
  if (!auction || auction.winnerId !== user.id) {
    redirect("/dashboard/portfolio");
  }

  const { premium, total, rate } = totalsFromLot(auction.currentPrice, auction.buyerPremiumRate);
  const premiumPercentLabel = `${Math.round(rate * 100)}%`;

  const img = auction.images[0];

  return (
    <div className="min-h-screen">
      <div className="mb-10">
        <Link
          href="/dashboard/portfolio"
          className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>
            arrow_back
          </span>
          Back to collection
        </Link>
      </div>

      <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:flex-row">
        <div className="relative h-[50vh] w-full overflow-hidden bg-surface-container-low lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:max-w-none">
          {img ? (
            <Image
              src={img}
              alt={`${auction.title} — artwork for checkout`}
              fill
              placeholder="blur"
              blurDataURL={TINY_IMAGE_BLUR}
              className="object-cover lg:object-contain"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center font-headline text-4xl text-outline-variant">
              ◆
            </div>
          )}
        </div>

        <div className="w-full flex-1 px-0 pb-20 pt-10 lg:w-1/2 lg:px-16 lg:pt-16">
          <div className="mx-auto max-w-xl lg:mx-0">
            <h1 className="mb-3 font-headline text-4xl tracking-tight text-on-surface lg:text-5xl">
              {auction.title}
            </h1>
            <p className="mb-10 font-body text-sm text-on-surface-variant">
              Lot settled in your favor. Review your invoice and confirm to begin settlement.
            </p>

            <section
              aria-labelledby="checkout-flow-heading"
              className="rounded-xl bg-surface-container-low/50 p-6 ring-1 ring-outline-variant/15 sm:p-8"
            >
              <h2 id="checkout-flow-heading" className="sr-only">
                Invoice and payment
              </h2>
              <nav
                aria-label="Checkout steps"
                className="mb-8 flex flex-wrap items-center gap-2 font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
              >
                <span className="rounded-full bg-primary px-3 py-1 text-on-primary">
                  1 · Invoice
                </span>
                <span className="text-on-surface-variant/50" aria-hidden>
                  →
                </span>
                <span className="rounded-full bg-surface-container-high px-3 py-1 ring-1 ring-outline-variant/20">
                  2 · Confirm
                </span>
              </nav>
              <div className="mb-10 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                <span className="font-label text-xs font-bold uppercase tracking-[0.3em] text-primary">
                  Awaiting payment
                </span>
              </div>

              <CheckoutPurchasePanel
                sessionUser={user}
                lotId={auction.id}
                hammer={formatMoney(auction.currentPrice)}
                buyerPremium={formatMoney(premium.toFixed(2))}
                total={formatMoney(total.toFixed(2))}
                premiumPercentLabel={premiumPercentLabel}
              />
            </section>

            <p className="mt-10 font-body text-xs text-on-surface-variant">
              <Link
                href={`/artwork/${auction.id}`}
                className="border-b border-outline-variant/40 hover:border-primary"
              >
                View full lot details
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
