"use client";

import { ShopMediaImage } from "@/components/media/shop-media-image";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { type CSSProperties, useCallback, useRef, useState } from "react";

/** Until the image has loaded, the frame holds a landscape shape so the layout does not jump far. */
const DEFAULT_ASPECT = 4 / 3;

type PrintStyle = CSSProperties & Record<"--print-aspect", string>;

/**
 * The release hung on the wall: the print whole inside a white border, with a soft shadow. The
 * border hugs the work at its own proportions, read from the image once it loads, so a portrait
 * and a landscape are framed alike and nothing is cropped.
 */
export function HomeFramedPrint({ src, alt }: { src: string; alt: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const onLoad = useCallback(() => {
    const image = imgRef.current;
    if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setAspect(image.naturalWidth / image.naturalHeight);
    }
  }, []);
  const style: PrintStyle = { "--print-aspect": aspect.toFixed(4) };

  return (
    <span className="shop-home-print" style={style}>
      <span className="shop-home-print__image">
        <ShopMediaImage
          src={src}
          alt={alt}
          label={SHOP_MEDIA_LABELS.artwork}
          sizes="(min-width: 64rem) 50vw, 90vw"
          priority
          imgRef={imgRef}
          onImageLoad={onLoad}
          className="absolute inset-0 size-full"
          imgClassName="object-contain"
        />
      </span>
    </span>
  );
}
