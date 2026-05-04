import { cn } from "@auction/ui";
import { useId } from "react";

export type MediaPlaceholderProps = {
  /** Short uppercase label, e.g. "Lot artwork", "Auction cover", or initials. */
  label?: string | undefined;
  tone?: "light" | "dark" | "auto" | undefined;
  /** Intrinsic aspect ratio, matching the mockup helper's [width, height]. */
  aspect?: readonly [number, number] | undefined;
  /** Fill the nearest relative parent. Defaults to true when no aspect is provided. */
  fill?: boolean | undefined;
  shape?: "rect" | "circle" | undefined;
  loading?: boolean | undefined;
  className?: string | undefined;
};

const SURFACE_CLASS = {
  light: "bg-[#e4e0da]",
  dark: "bg-[#1c1e1e]",
  auto: "bg-[#e4e0da] dark:bg-[#1c1e1e]",
} as const;

const LINE_CLASS = {
  light: "text-[#d8d3cb]",
  dark: "text-[#232626]",
  auto: "text-[#d8d3cb] dark:text-[#232626]",
} as const;

const LABEL_CLASS = {
  light: "text-[#aaa9a2]",
  dark: "text-[#4a4d4d]",
  auto: "text-[#aaa9a2] dark:text-[#4a4d4d]",
} as const;

export function MediaPlaceholder({
  label,
  tone = "auto",
  aspect,
  fill,
  shape = "rect",
  loading = false,
  className,
}: MediaPlaceholderProps) {
  const patternId = useId().replace(/:/g, "");
  const shouldFill = fill ?? !aspect;
  const normalizedLabel = label?.trim();

  return (
    <div
      role="img"
      aria-label={normalizedLabel ? `${normalizedLabel} placeholder` : "Image placeholder"}
      className={cn(
        "overflow-hidden",
        shouldFill ? "absolute inset-0 h-full w-full" : "relative w-full",
        shape === "circle" && "rounded-full",
        loading && "animate-pulse",
        SURFACE_CLASS[tone],
        className,
      )}
      style={aspect ? { aspectRatio: `${aspect[0]} / ${aspect[1]}` } : undefined}
    >
      <svg
        width="100%"
        height="100%"
        className={cn("block h-full w-full", SURFACE_CLASS[tone], LINE_CLASS[tone])}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <title>
          {normalizedLabel ? `${normalizedLabel} placeholder pattern` : "Image placeholder pattern"}
        </title>
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="18"
            height="18"
            patternTransform="rotate(45)"
          >
            <rect width="18" height="18" fill="transparent" />
            <rect width="1" height="18" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      {normalizedLabel ? (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center px-2 text-center font-mono text-[9px] uppercase tracking-[0.05em]",
            LABEL_CLASS[tone],
          )}
        >
          {normalizedLabel}
        </span>
      ) : null}
    </div>
  );
}
