import { LotMediaBlock } from "@/components/sections/artwork/redesign/lot-media-block";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";

type Props = {
  lot: Lot;
  className?: string;
};

/** Center column: hero media with mockup-aligned max width and entrance motion. */
export function LotImageArea({ lot, className }: Props) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-reduce:animate-none",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[786px] overflow-hidden rounded-lg border border-border-hairline bg-surface-container-lowest shadow-sm dark:bg-surface-container-low/30">
        <LotMediaBlock lot={lot} />
      </div>
    </div>
  );
}
