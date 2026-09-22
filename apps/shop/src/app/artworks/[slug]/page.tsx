import { AddToBasketButton } from "@/components/artwork/add-to-basket-button";
import { ArtworkUnavailablePanel } from "@/components/artwork/artwork-unavailable-panel";
import { ShopMediaImage } from "@/components/media/shop-media-image.server";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { presentArtworkAvailability } from "@/lib/presenters/artwork-availability.presenter";
import {
  isArtworkPriceEnquiryAvailable,
  isArtworkPurchasable,
  resolveArtworkUnavailableReason,
} from "@/lib/presenters/artwork-commerce.presenter";
import { fetchPublicArtworkBySlug } from "@/lib/shop-api.server";
import { fetchArtworkInterestStatus } from "@/lib/shop-artwork-interest.server";
import { formatGbpPence } from "@/lib/shop-commerce.server";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { FOCUS_RING } from "@auction/branding";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type ArtworkPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const artwork = await fetchPublicArtworkBySlug(slug);
    if (!artwork) {
      return { title: "Artwork not found | LAX Shop", robots: { index: false, follow: false } };
    }
    const description =
      artwork.description ?? `${artwork.title} by ${artwork.artistName} at LAX Shop.`;
    return {
      title: `${artwork.title} | LAX Shop`,
      description,
      alternates: { canonical: `/artworks/${encodeURIComponent(slug)}` },
      openGraph: {
        type: "article",
        title: artwork.title,
        description,
        ...(artwork.imageUrl ? { images: [{ url: artwork.imageUrl, alt: artwork.title }] } : {}),
      },
    };
  } catch {
    return { title: "Artwork | LAX Shop", robots: { index: false, follow: false } };
  }
}

export default async function ArtworkDetailPage({ params }: ArtworkPageProps) {
  const { slug } = await params;
  const [artwork, viewer] = await Promise.all([
    fetchPublicArtworkBySlug(slug),
    loadShopViewerState(),
  ]);
  if (!artwork) {
    notFound();
  }
  const printPricePence = artwork.printPricePence;
  const purchasable = isArtworkPurchasable(artwork);
  const priceEnquiryAvailable = isArtworkPriceEnquiryAvailable(artwork);
  const unavailableReason = resolveArtworkUnavailableReason(artwork);
  const interestIntent =
    unavailableReason === "edition_sold_out"
      ? "notify_me"
      : unavailableReason === "price_enquiry"
        ? "enquiry"
        : artwork.eligibleForEditionAllocation
          ? "notify_me"
          : "enquiry";
  const availability = presentArtworkAvailability(artwork);
  const interestRead =
    viewer.kind === "authenticated" && unavailableReason !== "sold"
      ? await fetchArtworkInterestStatus(slug, interestIntent)
      : { status: "guest" as const };

  return (
    <MarketingDetailShell
      wayfinding={
        <Link
          href="/artworks"
          className={cn("text-link underline-offset-4 hover:underline", FOCUS_RING)}
        >
          ← Back to artworks
        </Link>
      }
      wayfindingClassName="pt-6"
      shellClassName="shop-page shop-page--detail"
    >
      <article className="shop-detail">
        <div className="shop-detail__media shop-detail__media--image">
          <ShopMediaImage
            src={artwork.imageUrl}
            alt={`${artwork.title} by ${artwork.artistName}`}
            label={SHOP_MEDIA_LABELS.artwork}
            aspect={[4, 5]}
            sizes="(min-width: 48rem) 58vw, 100vw"
            priority
            className="absolute inset-0 size-full"
          />
        </div>
        <div className="shop-detail__content">
          <div className="shop-detail__heading">
            <p className="shop-detail__eyebrow">LAX Shop catalogue</p>
            <h1>{artwork.title}</h1>
            <p className="shop-detail__artist">{artwork.artistName}</p>
          </div>
          <section className="shop-detail__section" aria-labelledby="availability-heading">
            <h2 id="availability-heading">Availability</h2>
            <div className="shop-detail__availability-heading">
              <p>{availability.headline}</p>
              <DotStatusPill label={availability.status.label} tone={availability.status.tone} />
            </div>
            {availability.meter ? (
              <div className="shop-detail__availability-meter" aria-hidden="true">
                <span
                  style={{
                    width: `${
                      availability.meter.total > 0
                        ? (availability.meter.available / availability.meter.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            ) : null}
            {availability.detail ? (
              <p className="shop-detail__availability-detail">{availability.detail}</p>
            ) : null}
          </section>
          {artwork.description ? (
            <section className="shop-detail__section" aria-labelledby="about-work-heading">
              <h2 id="about-work-heading">About the work</h2>
              <p>{artwork.description}</p>
            </section>
          ) : null}
          {priceEnquiryAvailable ? (
            <section className="shop-detail__section" aria-labelledby="price-heading">
              <h2 id="price-heading">Price</h2>
              <p>Price on request. Contact LAX and we will share the price for this work.</p>
            </section>
          ) : null}
          {purchasable && printPricePence !== null ? (
            <>
              <section className="shop-detail__section" aria-labelledby="price-heading">
                <h2 id="price-heading">Print price</h2>
                <p>{formatGbpPence(printPricePence)} (tax inclusive)</p>
              </section>
              <AddToBasketButton slug={artwork.slug} />
            </>
          ) : unavailableReason ? (
            <ArtworkUnavailablePanel
              viewer={viewer}
              artworkSlug={artwork.slug}
              reason={unavailableReason}
              interestRead={interestRead}
            />
          ) : null}
        </div>
      </article>
    </MarketingDetailShell>
  );
}
