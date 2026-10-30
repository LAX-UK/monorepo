import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ShopEditionLinkVm } from "@/lib/artwork/shop-editions.vm";
import { marketingArtistInitials } from "@auction/marketing-ui";

/**
 * "Editions available in LAX Shop": the limited editions made from this original, each linking to
 * its LAX Shop page. Shows the edition size and Available or Sold out, never a remaining count.
 */
export function ArtShopEditions({ editions }: { editions: readonly ShopEditionLinkVm[] }) {
  if (editions.length === 0) return null;
  return (
    <section
      aria-labelledby="shop-editions-heading"
      className="flex flex-col gap-4 border-t border-outline-variant/60 pt-6"
      data-testid="art-shop-editions"
    >
      <div className="flex flex-col gap-1">
        <h2 id="shop-editions-heading" className="text-base font-medium text-on-surface">
          Editions available in LAX Shop
        </h2>
        <p className="text-sm text-on-surface-variant">
          Limited edition prints of this work, sold online.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {editions.map((edition) => (
          <li key={edition.slug}>
            <a
              href={edition.href}
              className="art-focus-ring group flex items-center gap-4 rounded-sm"
            >
              <span className="relative block size-16 shrink-0 overflow-hidden bg-surface-container">
                <ArtMediaImage
                  src={edition.imageUrl}
                  alt=""
                  aspect={[1, 1]}
                  sizes="4rem"
                  label={marketingArtistInitials(edition.artistName)}
                  className="absolute inset-0 size-full"
                  imgClassName="object-contain"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base text-on-surface underline-offset-4 group-hover:underline">
                  {edition.title}
                </span>
                <span className="text-sm text-on-surface-variant">{edition.editionLine}</span>
              </span>
              {edition.priceLabel ? (
                <span className="shrink-0 text-sm font-medium text-on-surface">
                  {edition.priceLabel}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
