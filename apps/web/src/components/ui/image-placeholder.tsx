import { cn } from "@auction/ui";
import { Image as ImageIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Reusable "no image" placeholder matching the marketing mockups.
 *
 * Renders a CSS-only diagonal striped pattern (no extra network request)
 * with an optional uppercase label and an icon. Designed to fill any
 * `relative` parent via `inset-0` so callers can drop it into the same
 * slot a `next/image` `fill` would have occupied.
 *
 * `tone="dark"` flips the palette for dark hero canvases.
 */
export type ImagePlaceholderProps = {
  /** Short uppercase label, e.g. "Hero artwork" / "Auction cover". */
  label?: string;
  /** Slot below the label for additional copy or icons. */
  children?: ReactNode;
  /** Visual surface — light = page surface, dark = on top of brand-900. */
  tone?: "light" | "dark";
  /** Hide the icon; leave only the stripes (useful for very small tiles). */
  hideIcon?: boolean;
  className?: string;
};

const LIGHT_BG = "bg-surface-container-high text-on-surface-variant";
const DARK_BG = "bg-brand-900 text-white/55";

const LIGHT_STRIPES =
  "[background-image:repeating-linear-gradient(135deg,rgba(120,113,108,0.18)_0,rgba(120,113,108,0.18)_1px,transparent_1px,transparent_12px)]";
const DARK_STRIPES =
  "[background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.16)_0,rgba(255,255,255,0.16)_1px,transparent_1px,transparent_12px)]";

export function ImagePlaceholder({
  label,
  children,
  tone = "light",
  hideIcon = false,
  className,
}: ImagePlaceholderProps) {
  const surface = tone === "dark" ? DARK_BG : LIGHT_BG;
  const stripes = tone === "dark" ? DARK_STRIPES : LIGHT_STRIPES;
  return (
    <div
      role="img"
      aria-label={label ? `${label} placeholder` : "Image placeholder"}
      className={cn("absolute inset-0 flex items-center justify-center", surface, className)}
    >
      <div className={cn("absolute inset-0", stripes)} aria-hidden />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        {hideIcon ? null : (
          <ImageIcon className="size-6 opacity-60" aria-hidden strokeWidth={1.5} />
        )}
        {label ? (
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.18em]">
            {label}
          </span>
        ) : null}
        {children}
      </div>
    </div>
  );
}
