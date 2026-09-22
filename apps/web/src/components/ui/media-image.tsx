"use client";

import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import {
  MediaImage as SharedMediaImage,
  type MediaImageProps as SharedMediaImageProps,
} from "@auction/marketing-ui";

export type MediaImageProps = Omit<SharedMediaImageProps, "resolveSrc">;

export function MediaImage(props: MediaImageProps) {
  return <SharedMediaImage {...props} resolveSrc={resolveMediaSrc} />;
}
