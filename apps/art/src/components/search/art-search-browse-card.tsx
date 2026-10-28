import { ArtMediaImage } from "@/components/media/art-media-image";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

/**
 * "Browse all" promo under the empty search prompt (Figma `886:18755`). Text sits on a fixed dark
 * scrim over photography, so it keeps the same contrast in both themes.
 */
export function ArtSearchBrowseCard({ imageUrl }: { imageUrl: string | null }) {
  return (
    <section
      aria-labelledby="art-search-browse-title"
      className="relative isolate flex min-h-60 overflow-hidden rounded-lg bg-brand-obsidian sm:min-h-72"
      data-testid="art-search-browse-card"
    >
      {imageUrl ? (
        <div aria-hidden className="absolute inset-0 -z-10">
          <ArtMediaImage
            src={imageUrl}
            alt=""
            sizes="(min-width: 48rem) 42rem, 100vw"
            className="size-full"
            imgClassName="object-cover"
          />
          <div className="absolute inset-0 bg-scrim-hero-mid" />
        </div>
      ) : null}
      <div className="flex w-full flex-col justify-end gap-3 p-6">
        <h2
          id="art-search-browse-title"
          className="font-headline text-lg font-medium text-brand-light-cream"
        >
          Looking for something distinctive?
        </h2>
        <Button
          asChild
          className="min-h-11 self-start rounded-sm bg-brand-light-cream px-4 font-body text-sm text-brand-obsidian hover:bg-brand-light-cream/90"
        >
          <Link href="/artworks" className="art-focus-ring">
            Browse all
          </Link>
        </Button>
      </div>
    </section>
  );
}
