import { type LaxLockupKind, laxLockup } from "@auction/branding";
import { cn } from "@auction/ui";
import type { CSSProperties } from "react";

export type LaxLockupProps = {
  kind: LaxLockupKind;
  /** Size it with a height utility (e.g. `h-8 w-auto`); the SVG keeps its aspect ratio. */
  className?: string;
};

/** The light-grey slash of the mark. It reads on both light and dark surfaces. */
const MIST = "#b9bac0";

/**
 * Inline LAX lockup that follows the surrounding theme without a second asset: the mark takes the
 * text colour and the descriptor takes `--color-product-accent`, which each app maps to its own
 * accent (and its dark-surface counterpart). Where an app has no accent the descriptor falls back
 * to the text colour, like the neutral lockups in `@auction/branding/lockups`.
 */
export function LaxLockup({ kind, className }: LaxLockupProps) {
  const lockup = laxLockup(kind);
  const descriptorStyle: CSSProperties = { fill: "var(--color-product-accent, currentColor)" };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={lockup.viewBox}
      width={lockup.width}
      height={lockup.height}
      role="img"
      aria-label={lockup.label}
      className={cn("lax-lockup", className)}
      fill="currentColor"
    >
      <title>{lockup.label}</title>
      {lockup.ink.map((path) => (
        <path key={path.d} d={path.d} />
      ))}
      {lockup.mist.map((path) => (
        <path key={path.d} d={path.d} fill={MIST} />
      ))}
      {lockup.descriptorPaths.map((path) => (
        <path
          key={`${path.transform ?? ""}${path.d}`}
          d={path.d}
          transform={path.transform}
          style={descriptorStyle}
        />
      ))}
    </svg>
  );
}
