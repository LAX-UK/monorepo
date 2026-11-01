import { cn } from "@auction/ui";
import { StatusBadge } from "@auction/ui/lax";

type Props = {
  featured?: boolean;
  verified?: boolean;
  /** The kind's label ("Marque", "Studio"), when the kind reads as an organisation. */
  kindLabel?: string | null;
  /** Over a portrait or work: adds the edge that keeps a neutral badge visible on any image. */
  onImage?: boolean;
};

const ON_IMAGE = "shadow-sm ring-1 ring-black/10 dark:ring-white/20";

/**
 * Bid's badges for an artist: the kit's neutral StatusBadge (20px, 4px corner, a shape cue), never
 * a navy fill. The shared artist card takes badges from its product, so Shop and lax.art keep
 * their own.
 */
export function ArtistBadges({ featured, verified, kindLabel, onImage = false }: Props) {
  const className = cn(onImage && ON_IMAGE);
  return (
    <>
      {featured ? (
        <StatusBadge tone="neutral" shape="ring" className={className}>
          Featured
        </StatusBadge>
      ) : null}
      {verified ? (
        <StatusBadge tone="neutral" shape="check" className={className}>
          Verified
        </StatusBadge>
      ) : null}
      {kindLabel ? (
        <StatusBadge tone="neutral" shape="dot" className={className}>
          {kindLabel}
        </StatusBadge>
      ) : null}
    </>
  );
}
