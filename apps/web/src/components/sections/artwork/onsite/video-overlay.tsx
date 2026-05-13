import { cn } from "@auction/ui";

type Props = {
  title: string;
  artistName: string;
  estimateLine: string | null;
  currentBidLabel: string;
  isLive?: boolean;
  /** e.g. time in GMT for mockup parity */
  clockLabel?: string | null;
  className?: string;
};

function LiveDot() {
  return (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
      <span className="absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full bg-live-red/70 motion-reduce:animate-none" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-live-red" />
    </span>
  );
}

/** Bottom gradient overlay on the video placeholder (mockup-style). */
export function VideoOverlay({
  title,
  artistName,
  estimateLine,
  currentBidLabel,
  isLive = false,
  clockLabel,
  className,
}: Props) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 flex flex-col", className)}>
      {isLive ? (
        <div className="pointer-events-auto flex flex-wrap gap-2 p-4">
          <div className="flex items-center gap-1 rounded-xl bg-black/50 px-3 py-2 backdrop-blur-sm">
            <LiveDot />
            <span className="font-body text-sm font-medium text-[#F1F1F3]">Live now</span>
          </div>
          {clockLabel ? (
            <div className="rounded-xl bg-black/50 px-3 py-2 font-body text-sm font-medium text-[#F1F1F3] backdrop-blur-sm">
              {clockLabel}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto bg-gradient-to-t from-black via-black/80 to-transparent px-6 pb-8 pt-24 sm:px-8">
        <div className="pointer-events-auto max-w-xl space-y-8">
          <div className="space-y-2">
            <h2 className="font-body text-2xl font-medium text-[#F1F1F3] sm:text-3xl">{title}</h2>
            <p className="font-body text-base font-medium text-[#D1D1D1]">{artistName}</p>
          </div>
          <div className="flex max-w-md items-center justify-between gap-6">
            <div className="space-y-2 text-left">
              <p className="font-body text-sm font-medium text-[#D1D1D1]">Estimate</p>
              <p className="font-body text-xl font-medium text-[#F1F1F3]">{estimateLine ?? "—"}</p>
            </div>
            <div className="space-y-2 text-left">
              <p className="font-body text-sm font-medium text-[#D1D1D1]">Current bid</p>
              <p className="font-body text-xl font-medium text-[#F1F1F3]">{currentBidLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
