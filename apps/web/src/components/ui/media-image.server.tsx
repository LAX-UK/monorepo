import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import {
  MediaImageServer,
  type MediaImageServerProps,
} from "@auction/marketing-ui/media/media-image.server";

export type MediaImageProps = Omit<MediaImageServerProps, "resolveSrc">;

/** Server-rendered catalogue image (no client hydration). */
export function MediaImage(props: MediaImageProps) {
  return <MediaImageServer {...props} resolveSrc={resolveMediaSrc} />;
}
