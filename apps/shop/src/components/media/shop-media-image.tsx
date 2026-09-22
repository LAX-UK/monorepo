"use client";

import { MediaImage, type MediaImageProps } from "@auction/marketing-ui";

export type ShopMediaImageProps = MediaImageProps;

/** Branded media with Bid-style hatch placeholder when src is missing or fails. */
export function ShopMediaImage(props: ShopMediaImageProps) {
  return <MediaImage {...props} />;
}
