"use client";

import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import { cn } from "@auction/staff-ui";
import { ImageOff } from "@auction/staff-ui/icons";

const SIZE = {
  sm: "size-10",
  md: "size-16",
  lg: "aspect-[4/3] w-full",
} as const;

/**
 * An artwork's primary image on staff pages, or a quiet placeholder when it has none yet. The
 * image is decorative here: the title beside it names the work.
 */
export function ArtworkThumbnail({
  url,
  size = "sm",
  className,
}: {
  url: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const src = useStaffCatalogueImage()(url);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-staff-sm border border-staff-line-subtle bg-staff-sunken",
        SIZE[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOff aria-hidden className="size-4 text-staff-subtle" strokeWidth={1.75} />
      )}
    </span>
  );
}
