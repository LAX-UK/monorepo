import { ArtworkAboutEditions } from "@/components/artwork/artwork-about-editions";
import { ArtworkArtistBlock } from "@/components/artwork/artwork-artist-block";
import { ArtworkBuyBox } from "@/components/artwork/artwork-buy-box.client";
import { ArtworkGallery } from "@/components/artwork/artwork-gallery.client";
import { ArtworkKeyFacts } from "@/components/artwork/artwork-key-facts";
import { ArtworkPurchaseFacts } from "@/components/artwork/artwork-purchase-facts";
import { ArtworkSpecList } from "@/components/artwork/artwork-spec-list";
import { ArtworkUnavailablePanel } from "@/components/artwork/artwork-unavailable-panel";
import { CatalogueGrid } from "@/components/catalogue-grid";
import { ShopGalleryTeamBand } from "@/components/gallery-team/shop-gallery-team-band";
import { ShopJsonLd } from "@/components/seo/shop-json-ld";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { SHOP_POLICY_PATHS, type ShopPolicySlug } from "@/content/policies/shop-policy-status";
import { buildArtworkProductPage } from "@/lib/artwork/artwork-product-page.vm";
import { loadCheckoutDeliveryTimes } from "@/lib/checkout/checkout-delivery.server";
import {
  loadShopArtBaseUrl,
  loadShopStorefrontBaseUrl,
} from "@/lib/ecosystem/product-directory.server";
import { buildGalleryTeam } from "@/lib/gallery-team/gallery-team.vm";
import { resolveOriginalArtworkUrl } from "@/lib/original-artwork-url.server";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";
import {
  isArtworkPurchasable,
  resolveArtworkUnavailableReason,
} from "@/lib/presenters/artwork-commerce.presenter";
import { presentDeliveryEstimate } from "@/lib/presenters/delivery-estimate.presenter";
import { artworkProductJsonLd } from "@/lib/seo/artwork-structured-data";
import {
  fetchPublicArtistBySlug,
  fetchPublicArtworkBySlug,
  fetchPublicArtworks,
} from "@/lib/shop-api.server";
import { fetchArtworkInterestStatus } from "@/lib/shop-artwork-interest.server";
import { fetchShopBasket } from "@/lib/shop-commerce.server";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { FOCUS_RING } from "@auction/branding";
import {
  MarketingArrowUpRightIcon,
  MarketingCheckIcon,
  MarketingDetailShell,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

type ArtworkPageProps = {
  params: Promise<{ slug: string }>;
};

/** Enough of the artist's editions to fill "Editions by {artist}" after leaving this one out. */
const ARTIST_EDITIONS_FETCH = 9;

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

function policyHref(linkable: readonly ShopPolicySlug[], slug: ShopPolicySlug): string | null {
  return linkable.includes(slug) ? SHOP_POLICY_PATHS[slug] : null;
}

export default async function ArtworkDetailPage({ params }: ArtworkPageProps) {
  const { slug } = await params;
  const [artwork, viewer, basketResult] = await Promise.all([
    fetchPublicArtworkBySlug(slug),
    loadShopViewerState(),
    fetchShopBasket(),
  ]);
  if (!artwork) {
    const originalOnArt = await resolveOriginalArtworkUrl(slug);
    if (originalOnArt) permanentRedirect(originalOnArt);
    notFound();
  }
  const basketLine =
    basketResult.status === "ok"
      ? basketResult.data.lines.find((line) => line.artworkSlug === slug)
      : undefined;
  const purchasable = isArtworkPurchasable(artwork);
  const unavailableReason = resolveArtworkUnavailableReason(artwork);
  const [artistEditions, artistDetail, interestRead] = await Promise.all([
    fetchPublicArtworks({ artistSlug: artwork.artistSlug, limit: ARTIST_EDITIONS_FETCH })
      .then((list) => list.items)
      .catch(() => []),
    fetchPublicArtistBySlug(artwork.artistSlug).catch(() => null),
    viewer.kind === "authenticated" && unavailableReason === "edition_sold_out"
      ? fetchArtworkInterestStatus(slug)
      : Promise.resolve({ status: "guest" as const }),
  ]);
  const vm = buildArtworkProductPage({
    artwork,
    artistEditions,
    artistDetail,
    artBaseUrl: loadShopArtBaseUrl(),
  });
  const deliveryEstimate = presentDeliveryEstimate({
    now: new Date(),
    times: loadCheckoutDeliveryTimes(),
  });
  const linkablePolicies = loadLinkableShopPolicies();
  const returnTo = `/artworks/${encodeURIComponent(artwork.slug)}`;
  const primaryImageUrl = vm.gallery.images[0]?.url ?? null;

  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--detail shop-page--edition">
      <ShopJsonLd data={artworkProductJsonLd(artwork, loadShopStorefrontBaseUrl())} />
      <ShopCommercePageShell
        header={{
          title: vm.title,
          suppressTitle: true,
          breadcrumbs: [
            { label: "Shop", href: "/" },
            { label: "Editions", href: "/artworks" },
            { label: vm.title },
          ],
        }}
        contentClassName="shop-detail-route"
      >
        <article className="shop-product">
          <div className="shop-product__media">
            <ArtworkGallery title={vm.title} gallery={vm.gallery} />
          </div>

          <div className="shop-product__summary">
            <header className="shop-product__heading">
              <p className="shop-product__eyebrow">Limited edition print</p>
              <h1 className="shop-product__title">{vm.title}</h1>
              <p className="shop-product__artist">
                <Link href={vm.artistHref} className={cn("shop-inline-link", FOCUS_RING)}>
                  {vm.artistName}
                </Link>
              </p>
              {vm.keyFacts.length === 0 && vm.sizeSummary ? (
                <p className="shop-product__size">{vm.sizeSummary}</p>
              ) : null}
            </header>
            <ArtworkKeyFacts facts={vm.keyFacts} />

            {purchasable && vm.purchase ? (
              <ArtworkBuyBox
                slug={vm.slug}
                title={vm.title}
                artistName={vm.artistName}
                imageUrl={primaryImageUrl}
                purchase={vm.purchase}
                inBasket={Boolean(basketLine)}
                basketLineId={basketLine?.lineId ?? null}
                signInHref={shopStorefrontLoginHref(returnTo)}
                facts={
                  <ArtworkPurchaseFacts
                    deliveryLine={vm.purchase.deliveryLine}
                    deliveryEstimate={deliveryEstimate}
                    returnsLine={vm.purchase.returnsLine}
                    deliveryHref={policyHref(linkablePolicies, "delivery")}
                    returnsHref={policyHref(linkablePolicies, "returns")}
                  />
                }
              />
            ) : unavailableReason ? (
              <div className="shop-buy shop-buy--sold-out">
                {vm.purchase ? (
                  <>
                    <div className="shop-buy__price">
                      <p className="shop-buy__amount">{vm.purchase.priceLabel}</p>
                      <p className="shop-buy__vat">{vm.purchase.vatNote}</p>
                    </div>
                    <p className="shop-buy__edition">
                      {vm.purchase.editionSize}
                      <span aria-hidden="true"> · </span>
                      <span className="shop-buy__availability" data-state="sold_out">
                        Sold out
                      </span>
                    </p>
                  </>
                ) : null}
                <ArtworkUnavailablePanel
                  viewer={viewer}
                  artworkSlug={artwork.slug}
                  reason={unavailableReason}
                  interestRead={interestRead}
                />
              </div>
            ) : null}

            {vm.specs.length > 0 ? (
              <section className="shop-product__section" aria-labelledby="details-heading">
                <h2 id="details-heading">Details</h2>
                <ArtworkSpecList rows={vm.specs} />
              </section>
            ) : null}

            <ArtworkAboutEditions />

            {vm.description ? (
              <section className="shop-product__section" aria-labelledby="about-work-heading">
                <h2 id="about-work-heading">About the work</h2>
                <p className="shop-product__prose">{vm.description}</p>
              </section>
            ) : null}

            <section className="shop-product__section" aria-labelledby="included-heading">
              <h2 id="included-heading">Included</h2>
              <ul className="shop-product__included">
                {vm.included.map((item) => (
                  <li key={item}>
                    <MarketingCheckIcon className="shop-product__included-icon" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {vm.crossLinks.originalOnArtHref ? (
              <a
                href={vm.crossLinks.originalOnArtHref}
                className={cn("shop-original-link", FOCUS_RING)}
              >
                <span className="shop-original-link__text">
                  <span className="shop-original-link__title">See the original at lax.art</span>
                  <span className="shop-original-link__body">
                    This edition is made from an original work by {vm.artistName}.
                  </span>
                </span>
                <MarketingArrowUpRightIcon className="shop-original-link__icon" />
              </a>
            ) : null}
          </div>
        </article>

        <ArtworkArtistBlock artist={vm.artist} />

        {vm.related.items.length > 0 ? (
          <section className="shop-product__related" aria-labelledby="related-heading">
            <div className="shop-product__related-header">
              <h2 id="related-heading">{vm.related.title}</h2>
              <Link
                href={vm.related.viewAllHref}
                className={cn("shop-inline-link", FOCUS_RING)}
                aria-label={`View all editions by ${vm.artistName}`}
              >
                View all
              </Link>
            </div>
            <CatalogueGrid
              items={vm.related.items}
              titleLevel={3}
              className="shop-catalogue__list--four"
            />
          </section>
        ) : null}

        <ShopGalleryTeamBand team={buildGalleryTeam()} />
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
