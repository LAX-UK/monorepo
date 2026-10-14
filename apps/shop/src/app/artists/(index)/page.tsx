import { ShopCatalogueEmpty } from "@/components/catalogue/shop-catalogue-empty";
import {
  ShopCatalogueHub,
  ShopCataloguePagerLink,
} from "@/components/catalogue/shop-catalogue-hub";
import { ArtistCard } from "@/components/home/cards/artist-card";
import { buildCatalogueArtistCards } from "@/lib/catalogue/catalogue-artist-card.vm";
import { fetchPublicArtists } from "@/lib/shop-api.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artists | LAX Shop",
  description: "Discover artists represented in the LAX Shop catalogue.",
  alternates: { canonical: "/artists" },
};

type ArtistsIndexPageProps = {
  searchParams: Promise<{ cursor?: string }>;
};

export default async function ArtistsIndexPage({ searchParams }: ArtistsIndexPageProps) {
  const query = await searchParams;
  const { items, nextCursor } = await fetchPublicArtists({
    limit: 24,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
  const cards = buildCatalogueArtistCards(items);

  return (
    <ShopCatalogueHub
      title="Artists"
      description="Discover artists represented in the LAX Shop catalogue."
      footer={
        nextCursor ? (
          <ShopCataloguePagerLink href={{ pathname: "/artists", query: { cursor: nextCursor } }}>
            Next artists
          </ShopCataloguePagerLink>
        ) : null
      }
    >
      {items.length === 0 ? (
        <ShopCatalogueEmpty
          title="No artists yet"
          description="Artist profiles will appear here as their work enters the shop catalogue."
          actionHref="/artworks"
          actionLabel="Browse all artworks"
        />
      ) : (
        <ul className="shop-catalogue__list">
          {cards.map((card) => (
            <li key={card.id}>
              <ArtistCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </ShopCatalogueHub>
  );
}
