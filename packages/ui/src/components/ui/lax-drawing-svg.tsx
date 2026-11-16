import type * as React from "react";
import { cn } from "../../lib/utils.js";
import type { LaxDrawing } from "./lax-drawings.js";

export type LaxIllustrationSize = "page" | "panel" | "compact";

/** Rendered widths; height follows the 4:3 grid. Compact sits in tables and staff panels. */
const SIZE_CLASS: Record<LaxIllustrationSize, string> = {
  page: "w-40",
  panel: "w-32",
  compact: "w-20",
};

/** Fade up once on first paint; still for anyone who prefers reduced motion. */
const MOTION_CSS =
  "@media (prefers-reduced-motion:no-preference){.lax-illustration{animation:lax-illustration-in .7s cubic-bezier(.2,.6,.2,1) both}}@keyframes lax-illustration-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}";

export type LaxDrawingSvgProps = {
  /** The drawing's name, for `data-illustration`. */
  name: string;
  /** Its path data, from `./lax-drawings.js`. */
  drawing: LaxDrawing;
  size?: LaxIllustrationSize;
  className?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "name" | "children">;

/**
 * Draws one LAX drawing from its path data. `LaxIllustration` picks the data by name from the
 * whole set; a component that only ever needs one drawing imports that one and renders this.
 */
export function LaxDrawingSvg({
  name,
  drawing,
  size = "panel",
  className,
  ...props
}: LaxDrawingSvgProps) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      data-illustration={name}
      className={cn(
        "lax-illustration block h-auto shrink-0 text-on-surface-variant",
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      <style>{MOTION_CSS}</style>
      {drawing.map((group) => (
        <g
          key={group.d[0]}
          {...(group.transform ? { transform: group.transform } : {})}
          {...(group.faint ? { opacity: 0.4 } : {})}
        >
          {group.d.map((d) => (
            <path key={d} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ))}
    </svg>
  );
}
