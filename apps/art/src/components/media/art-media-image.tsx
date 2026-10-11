"use client";

import { MediaImage, type MediaImageProps } from "@auction/marketing-ui";

export type ArtMediaImageProps = MediaImageProps;

/** Branded media with Bid-style hatch placeholder when src is missing or fails. */
export function ArtMediaImage(props: ArtMediaImageProps) {
  return <MediaImage {...props} />;
}
