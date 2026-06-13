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
  light: "bg-surface-container",
  dark: "bg-surface-container-low",
  auto: "bg-surface-container dark:bg-surface-container-low",
} as const;

const LINE_CLASS = {
  light: "text-brand-100",
  dark: "text-brand-400",
  auto: "text-brand-100 dark:text-brand-400",
} as const;

const LABEL_CLASS = {
  light: "text-brand-300",
  dark: "text-brand-400",
  auto: "text-brand-300 dark:text-brand-400",
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
          {/* `useId()` can resolve to different values between SSR-stream and
              client-hydrate when this component lives inside a Suspense boundary;
              the id only links the <pattern> to the <rect> fill so a mismatch
              has no functional consequence. Suppress the warning to avoid noise. */}
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="18"
            height="18"
            patternTransform="rotate(45)"
            suppressHydrationWarning
          >
            <rect width="18" height="18" fill="transparent" />
            <rect width="1" height="18" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} suppressHydrationWarning />
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
