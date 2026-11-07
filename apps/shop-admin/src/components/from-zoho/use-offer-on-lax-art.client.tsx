"use client";

import { OfferOnLaxArtDialog } from "@/components/from-zoho/offer-on-lax-art-dialog.client";
import { useStaffAccess } from "@auction/staff-ui";
import { type ReactNode, useCallback, useState } from "react";

/**
 * Offering an artwork on lax.art makes a lax.art artwork (`catalogue.write`) from a record in the
 * register, and the people who decide on the register (`artwork_register.review`) put its
 * artworks on sale. shop-api checks both; this leaves the action out for anyone without them.
 */
export function useCanOfferOnLaxArt(): boolean {
  const access = useStaffAccess();
  return access.can("catalogue.write") && access.can("artwork_register.review");
}

/**
 * The "Offer on lax.art…" dialog for one record, opened from wherever the action sits (the record
 * page, a queue row). Render `dialog` once; call `start` to open it.
 */
export function useOfferOnLaxArt(input: { registerId: string; title: string }): {
  start: () => void;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const start = useCallback(() => setOpen(true), []);
  const dialog = open ? (
    <OfferOnLaxArtDialog
      open={open}
      onOpenChange={setOpen}
      registerId={input.registerId}
      title={input.title}
    />
  ) : null;
  return { start, dialog };
}
