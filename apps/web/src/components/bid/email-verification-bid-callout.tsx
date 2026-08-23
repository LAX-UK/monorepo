"use client";

import { BidBlockerNotice } from "@/components/bid/bid-blocker-notice";
import type { BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";

export function emailVerificationBidBlockerPresentation(
  email: string,
  returnPath: string,
): BidBlockerPresentation {
  return {
    tone: "warning",
    title: "Verify your email to bid",
    detail: email
      ? `We’ll send a secure verification link to ${email}. After verification, you’ll return to this lot.`
      : "Verify your email address to continue. After verification, you’ll return to this lot.",
    action: {
      kind: "email",
      email,
      next: returnPath,
      label: "Send verification email",
      shortLabel: "Verify email",
    },
    preview: "After verification, you can place a one-time bid or set an auto-bid on this lot.",
  };
}

export function EmailVerificationBidCallout({
  email,
  returnPath,
}: {
  email: string;
  returnPath: string;
}) {
  return (
    <BidBlockerNotice presentation={emailVerificationBidBlockerPresentation(email, returnPath)} />
  );
}
