/** Normalized image for lot/marketing galleries (DIP: consumers use this, not raw URLs). */
export type GalleryImage = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
};

/** Shared contract for dot pile, counter, and future position indicators (LSP). */
export type PositionIndicatorProps = {
  total: number;
  index: number;
  onSelect: (i: number) => void;
  onOverflow?: () => void;
  className?: string;
};

export function toGalleryImages(
  urls: string[],
  alts?: (string | undefined)[],
  title?: string,
  assets?: GalleryImage[],
): GalleryImage[] {
  return urls.map((src, i) => {
    const asset = assets?.[i];
    const custom = alts?.[i]?.trim();
    const alt =
      custom || (urls.length > 1 && title ? `${title} — image ${i + 1} of ${urls.length}` : title);
    const image: GalleryImage = { src };
    if (alt) image.alt = alt;
    if (asset?.width != null) image.width = asset.width;
    if (asset?.height != null) image.height = asset.height;
    if (asset?.blurDataURL) image.blurDataURL = asset.blurDataURL;
    return image;
  });
}

export function formatGalleryIndex(i: number, total: number): string {
  const pad = String(total).length;
  return `${String(i + 1).padStart(pad, "0")} / ${total}`;
}
