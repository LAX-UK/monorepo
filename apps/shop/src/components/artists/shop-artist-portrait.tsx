import { ShopMediaImage } from "@/components/media/shop-media-image";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { marketingArtistInitials } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";

/**
 * An artist's portrait at 4:5, as the shared artist card frames it; without a portrait, the
 * shared hatch with the artist's initials, as on the card.
 */
export function ShopArtistPortrait({
  name,
  src,
  sizes,
  className,
}: {
  name: string;
  src: string | null;
  sizes: string;
  className?: string;
}) {
  return (
    <span className={cn("shop-artist-portrait", className)}>
      {src ? (
        <ShopMediaImage
          src={src}
          alt=""
          label={SHOP_MEDIA_LABELS.artistPortrait}
          aspect={[4, 5]}
          sizes={sizes}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          <MediaPlaceholder fill />
          <span className="shop-artist-portrait__initials" aria-hidden="true">
            {marketingArtistInitials(name)}
          </span>
        </>
      )}
    </span>
  );
}
