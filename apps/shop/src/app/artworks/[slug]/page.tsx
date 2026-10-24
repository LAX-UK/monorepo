import { AddToBasketButton } from "@/components/artwork/add-to-basket-button";
import { ArtworkUnavailablePanel } from "@/components/artwork/artwork-unavailable-panel";
import { ShopMediaImage } from "@/components/media/shop-media-image.server";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { resolveOriginalArtworkUrl } from "@/lib/original-artwork-url.server";
import { presentArtworkAvailability } from "@/lib/presenters/artwork-availability.presenter";
import {
  isArtworkPurchasable,
  resolveArtworkUnavailableReason,
} from "@/lib/presenters/artwork-commerce.presenter";
import { fetchPublicArtworkBySlug } from "@/lib/shop-api.server";
import { fetchArtworkInterestStatus } from "@/lib/shop-artwork-interest.server";
import { fetchShopBasket } from "@/lib/shop-commerce.server";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { FOCUS_RING } from "@auction/branding";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { formatGbpPence } from "@auction/shop-portal/vm";
import { cn } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

type ArtworkPageProps = {
  params: Promise<{ slug: string }>;
};

const EDITION_WHAT_YOU_GET_BULLETS = [
  "Certificate of authenticity for your edition",
  "Professional packaging and insured UK delivery options at checkout",
  "Edition number assigned when your order is fulfilled",
  "Order updates and documents in your LAX account",
] as const;

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
  const [artwork, viewer, basketResult] = await Promise.all([
    fetchPublicArtworkBySlug(slug),
    loadShopViewerState(),
    fetchShopBasket(),
  ]);
  const basketLine =
    basketResult.status === "ok"
      ? basketResult.data.lines.find((line) => line.artworkSlug === slug)
      : undefined;
  if (!artwork) {
    const originalOnArt = await resolveOriginalArtworkUrl(slug);
    if (originalOnArt) permanentRedirect(originalOnArt);
    notFound();
  }
  const printPricePence = artwork.printPricePence;
  const purchasable = isArtworkPurchasable(artwork);
  const unavailableReason = resolveArtworkUnavailableReason(artwork);
  const availability = presentArtworkAvailability(artwork);
  const interestRead =
    viewer.kind === "authenticated" && unavailableReason === "edition_sold_out"
      ? await fetchArtworkInterestStatus(slug)
      : { status: "guest" as const };

  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--detail">
      <ShopCommercePageShell
        header={{
          title: artwork.title,
          suppressTitle: true,
          breadcrumbs: [
            { label: "Shop", href: "/" },
            { label: "Artworks", href: "/artworks" },
            { label: artwork.title },
          ],
        }}
        contentClassName="shop-detail-route"
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
              <p className="shop-detail__eyebrow">Limited edition print</p>
              <h1>{artwork.title}</h1>
              <p className="shop-detail__artist">
                <Link
                  href={`/artists/${encodeURIComponent(artwork.artistSlug)}`}
                  className={cn("text-link underline underline-offset-4", FOCUS_RING)}
                >
                  {artwork.artistName}
                </Link>
              </p>
            </div>

            <div className="shop-detail__purchase">
              {purchasable && printPricePence !== null ? (
                <>
                  <p className="shop-detail__price-lead">
                    {formatGbpPence(printPricePence)}{" "}
                    <span className="text-on-surface-variant">(tax inclusive)</span>
                  </p>
                  <AddToBasketButton
                    slug={artwork.slug}
                    inBasket={Boolean(basketLine)}
                    basketLineId={basketLine?.lineId ?? null}
                  />
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

            <section className="shop-detail__section" aria-labelledby="availability-heading">
              <h2 id="availability-heading">Availability</h2>
              <div className="shop-detail__availability-heading">
                <p>{availability.headline}</p>
                <DotStatusPill label={availability.status.label} tone={availability.status.tone} />
              </div>
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

            <section className="shop-detail__section" aria-labelledby="what-you-get-heading">
              <h2 id="what-you-get-heading">What you get</h2>
              <ul className="shop-detail__bullets">
                {EDITION_WHAT_YOU_GET_BULLETS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
