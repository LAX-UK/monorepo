import type { LaxFamilyBarHelpLink } from "@auction/marketing-ui";
import type { ReactNode } from "react";

export type ArtHelpLink = { label: string; href: string };

export const ART_ENQUIRE_HREF = "/contact";

/** Right side of the LAX top bar, and the help list in the phone menu. */
export const ART_HELP_LINKS: readonly ArtHelpLink[] = [
  { label: "Visit us", href: "/visit" },
  { label: "Enquire", href: ART_ENQUIRE_HREF },
  { label: "Help", href: "/help" },
];

/**
 * The top bar's help links. When `renderEnquire` is given (signed in), Enquire becomes that
 * control, which opens the enquiry sheet; otherwise it links to /contact like everyone else.
 */
export function buildArtTopBarHelpLinks(
  renderEnquire?: (className: string) => ReactNode,
): LaxFamilyBarHelpLink[] {
  return ART_HELP_LINKS.map((link) =>
    link.href === ART_ENQUIRE_HREF && renderEnquire ? { ...link, render: renderEnquire } : link,
  );
}
