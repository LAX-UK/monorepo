"use client";

import { whenSignedIn } from "@/components/layout/signed-in-only";
import dynamic from "next/dynamic";

/**
 * The phone header's account switcher button. Only someone with an organisation sees it, and it
 * draws nothing until their accounts are read, so it loads for signed-in visitors only.
 */
export const BidPhoneAccount = whenSignedIn(
  dynamic(
    () =>
      import("@/components/layout/bid-phone-account-button").then((mod) => ({
        default: mod.BidPhoneAccountButton,
      })),
    { ssr: false },
  ),
);
