import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import type { ReactNode } from "react";
import { MarketingArtistInitials, marketingArtistInitials } from "./marketing-artist-card.js";

export type MarketingArtistPortraitFillProps = {
  name: string;
  /** The product's portrait image, filling its frame. */
  image?: ReactNode;
  /**
   * What shows without an image: the shared hatch with initials (`placeholder`, the default) or
   * the initials alone on the plain surface (`initials`).
   */
  withoutImage?: "placeholder" | "initials";
};

/**
 * The content of a 4:5 portrait frame: the image when there is one, else the artist's initials
 * (on the shared hatch, or on the plain surface). The host owns the frame (aspect, size, link).
 */
export function MarketingArtistPortraitFill({
  name,
  image,
  withoutImage = "placeholder",
}: MarketingArtistPortraitFillProps) {
  if (image) return <>{image}</>;
  if (withoutImage === "initials") return <MarketingArtistInitials name={name} />;
  return <MediaPlaceholder fill monogram={marketingArtistInitials(name)} />;
}
