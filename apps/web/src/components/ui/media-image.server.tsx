import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { MediaImageServer, type MediaImageServerProps } from "@auction/marketing-ui";

export type MediaImageProps = Omit<MediaImageServerProps, "resolveSrc">;

/** Server-rendered catalogue image (no client hydration). */
export function MediaImage(props: MediaImageProps) {
  return <MediaImageServer {...props} resolveSrc={resolveMediaSrc} />;
}
