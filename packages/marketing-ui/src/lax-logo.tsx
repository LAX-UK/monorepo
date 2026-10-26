import type { LaxLockupKind } from "@auction/branding";
import { cn } from "@auction/ui";
import { LaxLockup } from "./lax-lockup.js";

export type LaxLogoProps = {
  /**
   * Which lockup to draw. `exchange` is the "London Art Exchange" wordmark lax.art shows; a
   * product passes its own lockup (for example `shop`, the LAX mark with ".SHOP").
   */
  kind?: LaxLockupKind;
  /** Size the wordmark with the wrapper's CSS (the SVG scales to its height). */
  className?: string;
};

/**
 * The LAX wordmark for the Shop and Art headers and footers. It is the inline vector lockup, so
 * the ink follows `.lax-logo`'s colour (see marketing-header.css): the header tone over a hero
 * image, the site theme and the OS setting all recolour it with no image filter.
 */
export function LaxLogo({ kind = "exchange", className }: LaxLogoProps) {
  return (
    <span className={cn("lax-logo", className)}>
      <LaxLockup kind={kind} />
    </span>
  );
}
