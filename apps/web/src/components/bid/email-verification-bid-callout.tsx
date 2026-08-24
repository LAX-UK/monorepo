"use client";

import { BidBlockerNotice } from "@/components/bid/bid-blocker-notice";
import { emailVerificationBidBlockerPresentation } from "@/lib/bid/presenters/email-verification-blocker.presenter";

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
