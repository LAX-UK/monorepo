"use client";

import { ArtFooterLink } from "@/components/layout/art-footer-link";
import { useArtViewerChrome } from "@/components/viewer/art-viewer-chrome.client";
import {
  artFooterAccountLinks,
  toArtFooterAccountState,
} from "@/lib/layout/art-footer-account-state";

/**
 * The footer's Account list. It follows the visitor, whom the browser reads, so it is the one part
 * of the footer drawn in the browser. Same markup as MarketingFooter's default list.
 */
export function ArtFooterAccountList() {
  const { account } = useArtViewerChrome();
  return (
    <ul className="flex flex-col gap-3">
      {artFooterAccountLinks(toArtFooterAccountState(account)).map((link) => (
        <li key={link.href}>
          <ArtFooterLink link={link} />
        </li>
      ))}
    </ul>
  );
}
