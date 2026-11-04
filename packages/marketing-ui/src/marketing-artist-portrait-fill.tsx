import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import type { ReactNode } from "react";
import { marketingArtistInitials } from "./marketing-artist-card.js";

export type MarketingArtistPortraitFillProps = {
  name: string;
  /** The product's portrait image, filling its frame; the hatch with initials shows without one. */
  image?: ReactNode;
};

/**
 * The content of a 4:5 portrait frame: the image when there is one, else the shared hatch with
 * the artist's initials, as on the artist card. The host owns the frame (aspect, size, link).
 */
export function MarketingArtistPortraitFill({ name, image }: MarketingArtistPortraitFillProps) {
  if (image) return <>{image}</>;
  return <MediaPlaceholder fill monogram={marketingArtistInitials(name)} />;
}
