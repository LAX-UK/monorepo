import { ShopMediaImage } from "@/components/media/shop-media-image";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { cn } from "@auction/ui";

export type ShopWorkMatProps = {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * One work whole on the shared work mat (4:5, the work inset 7%), as the edition card shows it,
 * for the places a work stands on its own: the first screen's release and a single new edition.
 * A landscape work sits whole inside the same 4:5 mat, so the layout never jumps.
 */
export function ShopWorkMat({ src, alt, sizes, priority = false, className }: ShopWorkMatProps) {
  return (
    <span className={cn("shop-work-mat marketing-work-mat", className)}>
      <span className="shop-work-mat__print">
        <ShopMediaImage
          src={src}
          alt={alt}
          label={SHOP_MEDIA_LABELS.artwork}
          sizes={sizes}
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-contain"
        />
      </span>
    </span>
  );
}
