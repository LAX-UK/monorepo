import { LOCKUP_HEIGHTS, PHONE_LOCKUP_TAGS } from "@auction/branding";
import { LaxLogo } from "@auction/marketing-ui";
import type { CSSProperties } from "react";

const heightVar = (px: number) => ({ "--lockup-h": `${px}px` }) as CSSProperties;

/**
 * lax.art's lockup. From 768px it is the wordmark at the shared desktop height (40px). Below
 * that it is the LAX mark at the shared phone height (28px) followed by the ".ART" tag. Both take
 * the header tone (white over a hero, ink otherwise) from the surrounding header.
 */
export function ArtLockup() {
  return (
    <span className="art-lockup flex items-center">
      <span className="hidden md:block" style={heightVar(LOCKUP_HEIGHTS.desktopArt)}>
        <LaxLogo className="art-header__logo" />
      </span>
      <span className="flex items-center gap-1 md:hidden">
        <span style={heightVar(LOCKUP_HEIGHTS.phoneMark)}>
          <LaxLogo kind="mark" className="art-header__logo" />
        </span>
        <span aria-hidden className="art-lockup__tag">
          {PHONE_LOCKUP_TAGS.art}
        </span>
      </span>
    </span>
  );
}
