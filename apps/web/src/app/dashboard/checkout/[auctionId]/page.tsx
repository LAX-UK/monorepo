import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ auctionId: string }>;
};

function totalsFromAuction(currentPrice: string, buyerPremiumRate: string) {
  const hammer = Number.parseFloat(currentPrice);
  const rate = Number.parseFloat(buyerPremiumRate);
  const safeHammer = Number.isFinite(hammer) ? hammer : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const premium = safeHammer * safeRate;
  const total = safeHammer + premium;
  return { hammer: safeHammer, premium, total, rate: safeRate };
}

export default async function DashboardCheckoutPage({ params }: PageProps) {
  const { auctionId } = await params;
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/?auth=required");
  }

  const reader = await getServerAuctionReader();
  const auction = await reader.getById(auctionId);
  if (!auction || auction.winnerId !== user.id) {
    redirect("/dashboard/portfolio");
  }

  const { premium, total, rate } = totalsFromAuction(
    auction.currentPrice,
    auction.buyerPremiumRate,
  );
  const premiumPercentLabel = `${Math.round(rate * 100)}%`;

  const img = auction.images[0];

  return (
    <div className="min-h-screen">
      <div className="mb-10">
        <Link
          href="/dashboard/portfolio"
          className="inline-flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary"
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
              alt=""
              fill
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
            <div className="mb-10 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
                Awaiting payment
              </span>
            </div>
            <h1 className="mb-3 font-headline text-4xl tracking-tight text-on-surface lg:text-5xl">
              {auction.title}
            </h1>
            <p className="mb-12 font-body text-sm text-on-surface-variant">
              Lot settled in your favor. Review your invoice and confirm to begin settlement.
            </p>

            <CheckoutPurchasePanel
              hammer={formatMoney(auction.currentPrice)}
              buyerPremium={formatMoney(premium.toFixed(2))}
              total={formatMoney(total.toFixed(2))}
              premiumPercentLabel={premiumPercentLabel}
            />

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
