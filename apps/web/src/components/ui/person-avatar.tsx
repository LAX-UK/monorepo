"use client";

import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { cn } from "@auction/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@auction/ui/components/avatar";

type Props = {
  src: string | null | undefined;
  /** The person's name, for the photo's alt text. */
  name: string;
  /** Shown when there is no photo, or while it loads. */
  initials: string;
  className?: string;
};

/**
 * A person's photo, or their initials on a plain tile. People are not artworks, so this never
 * uses the hatched artwork placeholder, whose stripes would cross the letters.
 */
export function PersonAvatar({ src, name, initials, className }: Props) {
  const resolved = resolveMediaSrc(src);
  return (
    <Avatar className={cn("size-10", className)}>
      {resolved ? <AvatarImage src={resolved} alt={name} className="object-cover" /> : null}
      <AvatarFallback
        aria-hidden
        className="bg-surface-container-high font-label text-sm font-medium text-on-surface"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
