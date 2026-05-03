import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import Image from "next/image";

type LotThumbnailProps = {
  src: string | null | undefined;
  alt: string;
  className: string;
  sizes: string;
};

export function LotThumbnail({ src, alt, className, sizes }: LotThumbnailProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden bg-surface-container-high ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill className="object-cover" sizes={sizes} />
      ) : (
        <ImagePlaceholder label="Lot artwork" hideIcon />
      )}
    </div>
  );
}
