"use client";

import { OfferAtAuctionDialog } from "@/components/artworks/offer-at-auction-dialog.client";
import type { OfferAtAuctionLinks } from "@/lib/offer-at-auction-links";
import { useStaffAccess } from "@auction/staff-ui";
import { type ReactNode, useCallback, useState } from "react";

/**
 * Offering a record at auction can take a live lax.art listing down (`catalogue.write`), and the
 * people who decide on the register (`artwork_register.review`) put its artworks on sale. shop-api
 * checks both; this leaves the action out for anyone without them.
 */
export function useCanOfferAtAuction(): boolean {
  const access = useStaffAccess();
  return access.can("catalogue.write") && access.can("artwork_register.review");
}

/**
 * The "Offer at auction…" dialog for one record, opened from wherever the action sits. Render
 * `dialog` once; call `start` to open it.
 */
export function useOfferAtAuction(input: {
  registerId: string;
  title: string;
  links: OfferAtAuctionLinks;
}): { start: () => void; dialog: ReactNode } {
  const [open, setOpen] = useState(false);
  const start = useCallback(() => setOpen(true), []);
  const dialog = open ? (
    <OfferAtAuctionDialog
      open={open}
      onOpenChange={setOpen}
      target={{ kind: "register", registerId: input.registerId }}
      title={input.title}
      links={input.links}
    />
  ) : null;
  return { start, dialog };
}
