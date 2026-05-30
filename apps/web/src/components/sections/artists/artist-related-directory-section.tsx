import { ArtistRelatedBrowseRail } from "@/components/sections/artists/catalog-artist-views";
import type { PublicArtistDirectoryRow } from "@auction/types";
import Link from "next/link";

type Props = {
  rows: PublicArtistDirectoryRow[];
  watchSet: ReadonlySet<string>;
  isAuthenticated: boolean;
  browseHref?: string;
};

/** Profile-page rail — directory cards for related artists. */
export function ArtistRelatedDirectorySection({
  rows,
  watchSet,
  isAuthenticated,
  browseHref = "/artists",
}: Props) {
  if (rows.length === 0) return null;

  return (
    <section
      className="mt-12 border-t border-border-hairline pt-10"
      aria-labelledby="related-artists"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="related-artists" className="font-headline text-xl text-on-surface">
            More in the directory
          </h2>
          <p className="mt-1 font-body text-xs text-on-surface-variant md:text-sm">
            Discover other artists, makers, and brands in the catalogue.
          </p>
        </div>
        <Link
          href={browseHref}
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          Browse all artists
        </Link>
      </div>
      <ArtistRelatedBrowseRail rows={rows} watchSet={watchSet} isAuthenticated={isAuthenticated} />
    </section>
  );
}
