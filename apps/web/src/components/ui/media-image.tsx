"use client";

import { MediaPlaceholder, type MediaPlaceholderProps } from "@/components/ui/media-placeholder";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { cn } from "@auction/ui";
import Image from "next/image";
import { useEffect, useState } from "react";

type MediaImageProps = {
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
  onClick?: (() => void) | undefined;
  placeholderClassName?: string | undefined;
};

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
  onClick,
  placeholderClassName,
}: MediaImageProps) {
  const normalizedSrc = resolveMediaSrc(src);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    normalizedSrc ? "loading" : "error",
  );

  useEffect(() => {
    setStatus(normalizedSrc ? "loading" : "error");
  }, [normalizedSrc]);

  const showPlaceholder = !normalizedSrc || status !== "loaded";
  const isCircle = shape === "circle";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        aspect ? "w-full" : "h-full w-full",
        isCircle && "rounded-full",
        className,
      )}
      style={aspect ? { aspectRatio: `${aspect[0]} / ${aspect[1]}` } : undefined}
    >
      {showPlaceholder ? (
        <MediaPlaceholder
          tone={tone}
          shape={shape}
          loading={Boolean(normalizedSrc && status === "loading")}
          {...(label !== undefined ? { label } : {})}
          {...(placeholderClassName !== undefined ? { className: placeholderClassName } : {})}
        />
      ) : null}
      {normalizedSrc && status !== "error" ? (
        <Image
          src={normalizedSrc}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          onClick={onClick}
          className={cn(
            "object-cover opacity-0 transition-opacity duration-300 motion-reduce:transition-none",
            status === "loaded" && "opacity-100",
            onClick && "cursor-pointer",
            imgClassName,
          )}
        />
      ) : null}
    </div>
  );
}

export type { MediaImageProps };
