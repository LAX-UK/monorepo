import { cn } from "@auction/ui";
import { Play } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  className?: string;
};

/** Placeholder stream surface; replace with real player when integrating video. */
export function VideoPlaceholder({ children, className }: Props) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-t-lg bg-[#1a1a1a] dark:bg-black",
        className,
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#0a0a0a]">
        <div className="rounded-full bg-white/10 p-5 text-white/90 backdrop-blur-sm transition-transform duration-300 motion-safe:hover:scale-105 motion-reduce:hover:scale-100">
          <Play className="size-12 fill-current pl-1" aria-hidden />
          <span className="sr-only">Video placeholder — stream not connected</span>
        </div>
      </div>
      {children}
    </div>
  );
}
