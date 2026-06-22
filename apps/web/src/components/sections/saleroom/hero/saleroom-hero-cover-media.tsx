"use client";

import { MediaImage } from "@/components/ui/media-image";

type Props = {
  coverImage: string | null;
  title: string;
  blurDataURL?: string | null;
};

export function SaleroomHeroCoverMedia({ coverImage, title, blurDataURL = null }: Props) {
  return (
    <div className="fade-up-d2 aspect-video w-full overflow-hidden bg-surface-container-low">
      <MediaImage
        src={coverImage}
        alt={`Cover for ${title}`}
        label={title.slice(0, 1).toUpperCase()}
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="size-full"
        {...(blurDataURL ? { blurDataURL } : {})}
      />
    </div>
  );
}
