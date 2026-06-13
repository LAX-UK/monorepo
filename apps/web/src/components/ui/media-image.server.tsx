import { MediaPlaceholder, type MediaPlaceholderProps } from "@/components/ui/media-placeholder";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { cn } from "@auction/ui";
import Image from "next/image";

export type MediaImageProps = {
  src: string | null | undefined;
  alt: string;
  label?: string | undefined;
  tone?: MediaPlaceholderProps["tone"] | undefined;
  aspect?: MediaPlaceholderProps["aspect"] | undefined;
  shape?: MediaPlaceholderProps["shape"] | undefined;
  sizes?: string | undefined;
  className?: string | undefined;
  imgClassName?: string | undefined;
  priority?: boolean | undefined;
  placeholderClassName?: string | undefined;
  blurDataURL?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

/** Server-rendered catalogue image (no client hydration). */
export function MediaImage({
  src,
  alt,
  label,
  tone = "auto",
  aspect,
  shape = "rect",
  sizes,
  className,
  imgClassName,
  priority = false,
  placeholderClassName,
  blurDataURL,
  width,
  height,
}: MediaImageProps) {
  const normalizedSrc = resolveMediaSrc(src);
  const useBlurPlaceholder = Boolean(blurDataURL) && !priority;
  const intrinsicAspect =
    aspect ??
    (width != null && height != null && width > 0 && height > 0
      ? ([width, height] as const)
      : undefined);
  const hasAspect = intrinsicAspect != null;
  const isCircle = shape === "circle";

  if (!normalizedSrc) {
    return (
      <MediaPlaceholder
        tone={tone}
        shape={shape}
        {...(label !== undefined ? { label } : {})}
        {...(placeholderClassName !== undefined ? { className: placeholderClassName } : {})}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        hasAspect ? "w-full" : "h-full w-full",
        isCircle && "rounded-full",
        className,
      )}
      style={
        hasAspect ? { aspectRatio: `${intrinsicAspect[0]} / ${intrinsicAspect[1]}` } : undefined
      }
    >
      <Image
        src={normalizedSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        {...(useBlurPlaceholder && blurDataURL
          ? { placeholder: "blur" as const, blurDataURL }
          : {})}
        className={cn("object-cover", imgClassName)}
      />
    </div>
  );
}
