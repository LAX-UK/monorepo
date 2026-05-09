import type { LotQueueCardVM } from "@/components/sections/artwork/artwork-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { CSSProperties } from "react";

export type LotQueueCardVariant = "current" | "upNext" | "queued";

type Props = {
  vm: LotQueueCardVM;
  variant: LotQueueCardVariant;
  /** Stagger index for motion-safe entrance */
  index?: number;
  className?: string;
};

export function LotQueueCard({ vm, variant, index = 0, className }: Props) {
  const lotNo =
    vm.lotNumber != null ? `${vm.lotNumber}.` : `${vm.id.replace(/-/g, "").slice(0, 4)}.`;
  const priceLine = vm.currentBid ?? vm.estimateLine ?? "—";

  const delayStyle: CSSProperties | undefined =
    index > 0 ? { animationDelay: `${Math.min(index, 8) * 45}ms` } : undefined;

  const body = (
    <div
      className={cn("flex w-full gap-4 motion-safe:animate-artwork-slide-up-fade", className)}
      style={delayStyle}
    >
      <div className="relative h-[120px] w-24 shrink-0 overflow-hidden bg-[#0A0A0A] dark:bg-black">
        <MediaImage
          src={vm.imageUrl}
          alt=""
          label="Lot"
          className="size-full transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
          sizes="96px"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 font-body text-[13px] font-medium leading-4 text-[#050505] dark:text-on-surface">
            {lotNo} {vm.title}
          </p>
          <p className="line-clamp-1 font-body text-xs font-light text-[#191919] dark:text-on-surface-variant">
            {vm.artistName}
          </p>
        </div>
        <p className="font-body text-sm font-medium tabular-nums text-[#050505] dark:text-on-surface">
          {priceLine}
        </p>
      </div>
    </div>
  );

  if (variant === "current") {
    return <div className="group">{body}</div>;
  }

  return (
    <Link
      href={vm.href}
      className="group block rounded-md outline-none ring-offset-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
    >
      {body}
    </Link>
  );
}
