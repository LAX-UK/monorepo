"use client";

import { MediaPlaceholder, type MediaPlaceholderProps } from "@/components/ui/media-placeholder";
import { cn } from "@auction/ui";

export const GALLERY_MEDIA_PLACEHOLDER_LABEL = "Lot artwork";

type Props = {
  variant: "inline" | "lightbox";
  loading?: boolean;
  className?: string;
  fill?: MediaPlaceholderProps["fill"];
};

/** Branded placeholder for lot gallery surfaces (hero, thumbs, lightbox). */
export function GalleryMediaPlaceholder({ variant, loading = false, className, fill }: Props) {
  return (
    <MediaPlaceholder
      label={GALLERY_MEDIA_PLACEHOLDER_LABEL}
      tone={variant === "lightbox" ? "dark" : "auto"}
      loading={loading}
      {...(fill !== undefined ? { fill } : {})}
      className={cn(className)}
    />
  );
}
