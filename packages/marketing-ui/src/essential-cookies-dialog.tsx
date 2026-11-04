"use client";

import { Button, Dialog, TextLink } from "@auction/ui/lax";
import { type ElementType, useEffect, useState } from "react";
import { COOKIE_SETTINGS_HASH } from "./footer-legal-column.js";

export type EssentialCookiesDialogProps = {
  /** How the product names itself, for example "LAX Shop". */
  productName: string;
  /** The cookie policy, when this product publishes it. */
  cookiePolicyHref?: string | undefined;
  /** The product's link component; a plain anchor when left out. */
  Link?: ElementType;
};

/**
 * "Cookie settings" for a product that sets no optional cookies. The footer link points at the
 * shared cookie-settings hash; this opens the dialog that says so, instead of leaving the link
 * out. A product with an analytics banner opens that banner from the same hash.
 */
export function EssentialCookiesDialog({
  productName,
  cookiePolicyHref,
  Link,
}: EssentialCookiesDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash !== COOKIE_SETTINGS_HASH) return;
      setOpen(true);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Cookie settings"
      description={`${productName} uses only the cookies it needs to work, so there is nothing to switch on or off.`}
      footer={
        <Button type="button" variant="primary" onClick={() => setOpen(false)}>
          Close
        </Button>
      }
    >
      <p className="text-lax-ui text-lax-muted">
        These cookies keep you signed in and remember your choices, such as your theme. We don’t use
        analytics or advertising cookies here.
        {cookiePolicyHref ? (
          <>
            {" "}
            <TextLink href={cookiePolicyHref} {...(Link ? { Link } : {})}>
              Read the cookie policy
            </TextLink>
          </>
        ) : null}
      </p>
    </Dialog>
  );
}
