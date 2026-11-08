import { ArtworkAboutWork } from "@/components/artwork/artwork-about-work";
import { ArtworkArtistSummary } from "@/components/artwork/artwork-artist-summary";
import { ArtworkBuyBox } from "@/components/artwork/artwork-buy-box.client";
import { ArtworkBuyColumn, ArtworkPriceBlock } from "@/components/artwork/artwork-buy-column";
import { ArtworkEditionFacts } from "@/components/artwork/artwork-edition-facts";
import { ArtworkGallery } from "@/components/artwork/artwork-gallery.client";
import { ArtworkMoreAbout } from "@/components/artwork/artwork-more-about.client";
import { ArtworkMoreBy } from "@/components/artwork/artwork-more-by";
import { ArtworkUnavailablePanel } from "@/components/artwork/artwork-unavailable-panel";
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
import { presentDeliveryLine } from "@/lib/presenters/delivery-estimate.presenter";
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
import { MarketingDetailShell } from "@auction/marketing-ui";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

type ArtworkPageProps = {
  params: Promise<{ slug: string }>;
};

/** Enough of the artist's editions to fill "More by {artist}" after leaving this one out. */
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
  const [artistList, artistDetail, interestRead] = await Promise.all([
    fetchPublicArtworks({ artistSlug: artwork.artistSlug, limit: ARTIST_EDITIONS_FETCH }).catch(
      () => null,
    ),
    fetchPublicArtistBySlug(artwork.artistSlug).catch(() => null),
    viewer.kind === "authenticated" && unavailableReason === "edition_sold_out"
      ? fetchArtworkInterestStatus(slug)
      : Promise.resolve({ status: "guest" as const }),
  ]);
  const vm = buildArtworkProductPage({
    artwork,
    artistEditions: artistList?.items ?? [],
    artistEditionCount: artistList?.totalCount,
    artistDetail,
    artBaseUrl: loadShopArtBaseUrl(),
  });
  const deliveryLine = presentDeliveryLine({
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
        <article className="shop-edition">
          <div className="shop-edition__stage">
            <ArtworkGallery title={vm.title} gallery={vm.gallery} />
          </div>

          <div className="shop-edition__buy">
            <ArtworkBuyColumn vm={vm}>
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
                  deliveryLine={deliveryLine}
                  deliveryHref={policyHref(linkablePolicies, "delivery")}
                  editionLine={vm.basketLine}
                />
              ) : unavailableReason ? (
                <div className="shop-buy shop-buy--sold-out">
                  {vm.purchase ? (
                    <ArtworkPriceBlock
                      priceLabel={vm.purchase.priceLabel}
                      vatNote={vm.purchase.vatNote}
                    />
                  ) : null}
                  <ArtworkUnavailablePanel
                    viewer={viewer}
                    artworkSlug={artwork.slug}
                    reason={unavailableReason}
                    interestRead={interestRead}
                  />
                </div>
              ) : null}
            </ArtworkBuyColumn>
          </div>

          <div className="shop-edition__details">
            {vm.facts ? <ArtworkEditionFacts facts={vm.facts} /> : null}
            {vm.facts?.statement || vm.about.description || vm.about.rows.length > 0 ? (
              <ArtworkMoreAbout statement={vm.facts?.statement}>
                <ArtworkAboutWork about={vm.about} />
              </ArtworkMoreAbout>
            ) : null}
          </div>
        </article>

        <ArtworkArtistSummary artist={vm.artist} />

        {vm.moreBy ? <ArtworkMoreBy moreBy={vm.moreBy} /> : null}

        <ShopGalleryTeamBand team={buildGalleryTeam({ context: "edition" })} />
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
