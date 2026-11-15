"use client";

import { clientPart } from "@/components/layout/client-part";
import { whenSignedIn } from "@/components/layout/signed-in-only";

/**
 * The phone header's account switcher button. Only someone with an organisation sees it, and it
 * draws nothing until their accounts are read, so it loads for signed-in visitors only.
 */
export const BidPhoneAccount = whenSignedIn(
  clientPart(() =>
    import("@/components/layout/bid-phone-account-button").then((mod) => mod.BidPhoneAccountButton),
  ),
);
