"use client";

import { cn } from "@auction/ui";

type Props = {
  durationMs: number;
  paused: boolean;
  active: boolean;
  reduceMotion: boolean;
  /** Changes reset the progress animation (new slide). */
  resetKey?: string | number;
  className?: string;
};

/** Thin autoplay progress strip along the top of the hero. */
export function HeroProgressBar({
  durationMs,
  paused,
  active,
  reduceMotion,
  resetKey = 0,
  className,
}: Props) {
  if (!active || reduceMotion) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-[var(--header-height)] z-20 h-0.5 bg-white/20",
        className,
      )}
      aria-hidden
    >
      <div
        key={`${resetKey}-${paused ? "p" : "r"}`}
        className="h-full w-full origin-left bg-brand-100 motion-reduce:animate-none"
        style={{
          animation: paused ? "none" : `hero-progress ${durationMs}ms linear forwards`,
        }}
      />
    </div>
  );
}
