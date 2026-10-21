import { ArtRail, ArtRailItem } from "@/components/layout/art-rail";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtworkObjectTypeTileVm } from "@/lib/catalogue/artwork-object-type-tiles.vm";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingCategoryTile } from "@auction/marketing-ui";

export type ArtObjectTypeTilesProps = {
  tiles: readonly ArtworkObjectTypeTileVm[];
};

/**
 * Medium tiles on the shared horizontal rail. Figma 538:4885 shows them without a heading; the
 * rail's own label names them for assistive tech.
 */
export function ArtObjectTypeTiles({ tiles }: ArtObjectTypeTilesProps) {
  if (tiles.length === 0) return null;
  return (
    <div data-testid="art-object-type-tiles">
      <ArtRail id="art-artworks-media-rail" label="Browse by medium">
        {tiles.map((tile) => (
          <ArtRailItem key={tile.objectType} size="tile">
            <MarketingCategoryTile
              href={tile.href}
              label={tile.label}
              meta={tile.countLabel}
              active={tile.active}
              className="art-focus-ring"
              image={
                <ArtMediaImage
                  src={tile.imageUrl}
                  alt=""
                  label={ART_MEDIA_LABELS.artwork}
                  aspect={[288, 295]}
                  sizes="13rem"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              }
            />
          </ArtRailItem>
        ))}
      </ArtRail>
    </div>
  );
}
