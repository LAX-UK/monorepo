import { LotMediaBlock } from "@/components/sections/artwork/redesign/lot-media-block";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";

type Props = {
  lot: Lot;
  /** When true, allow a wider hero when the queue sidebar is hidden. */
  wide?: boolean;
  className?: string;
};

/** Center column: hero media with mockup-aligned max width and entrance motion. */
export function LotImageArea({ lot, wide = false, className }: Props) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-reduce:animate-none",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto w-full overflow-hidden rounded-lg border border-border-hairline bg-surface-container-lowest shadow-sm dark:bg-surface-container-low/30",
          wide ? "max-w-[900px]" : "max-w-[786px]",
        )}
      >
        <LotMediaBlock lot={lot} wide={wide} />
      </div>
    </div>
  );
}
