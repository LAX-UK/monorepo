"use client";

import { ArtFooterLink } from "@/components/layout/art-footer-link";
import { useArtViewerChrome } from "@/components/viewer/art-viewer-chrome.client";
import {
  artFooterAccountLinks,
  toArtFooterAccountState,
} from "@/lib/layout/art-footer-account-state";
import { cn } from "@auction/ui";

/** Every visitor's list is this many rows tall, so the footer never changes height. */
const ROWS = 2;

/**
 * The footer's Account list. It follows the visitor, whom the browser reads, so it is the one part
 * of the footer drawn in the browser. Same markup as MarketingFooter's default list. Until the
 * visitor is read the rows keep their place, invisible; a shorter list (a disabled account) keeps
 * the same height with an empty row.
 */
export function ArtFooterAccountList() {
  const { account, settled } = useArtViewerChrome();
  const links = artFooterAccountLinks(toArtFooterAccountState(account));
  const spacers = Math.max(0, ROWS - links.length);
  return (
    <ul
      data-testid="art-footer-account-list"
      data-account-ready={settled ? "true" : "false"}
      aria-hidden={settled ? undefined : true}
      inert={!settled}
      className={cn("flex flex-col gap-3", !settled && "invisible")}
    >
      {links.map((link) => (
        <li key={link.href}>
          <ArtFooterLink link={link} />
        </li>
      ))}
      {Array.from({ length: spacers }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: empty rows that only hold the height
        <li key={`spacer-${index}`} aria-hidden className="invisible">
          <span className="font-footer-links text-base leading-6">&nbsp;</span>
        </li>
      ))}
    </ul>
  );
}
