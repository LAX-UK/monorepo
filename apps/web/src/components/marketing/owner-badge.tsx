"use client";

import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";

type Props = {
  owned: boolean;
  className?: string;
};

/** Shown on lot cards when the signed-in user is the lot seller. */
export function OwnerBadge({ owned, className = "" }: Props) {
  const tone = useOverlayTone("topLeft");
  const opaqueTone = { ...tone, kind: "opaque" as const };

  if (!owned) return null;
  return (
    <span
      className={cn(
        overlayPillClasses(opaqueTone),
        "inline-flex shrink-0 rounded-md px-2 py-1 font-label text-[0.6rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary shadow-sm ring-1 ring-primary/25",
        className,
      )}
      {...overlayToneProps(opaqueTone)}
      aria-label="Your listing"
    >
      Your listing
    </span>
  );
}
