import { MediaImage } from "@/components/ui/media-image";

type LotThumbnailProps = {
  src: string | null | undefined;
  alt: string;
  className: string;
  sizes: string;
};

export function LotThumbnail({ src, alt, className, sizes }: LotThumbnailProps) {
  return (
    <MediaImage
      src={src}
      alt={alt}
      label="Lot artwork"
      sizes={sizes}
      className={`shrink-0 bg-surface-container-high ${className}`}
    />
  );
}
