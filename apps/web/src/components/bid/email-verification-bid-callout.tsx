"use client";

import { SendVerificationEmailButton } from "@/components/auth/send-verification-email-button";

export function EmailVerificationBidCallout({
  email,
  returnPath,
}: {
  email: string;
  returnPath: string;
}) {
  return (
    <div
      className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-center text-sm text-on-surface-variant"
      role="alert"
      aria-live="polite"
    >
      <p className="font-medium text-on-surface">Email verification required</p>
      <p className="mt-2 text-pretty">
        Verify your email address before bidding. We will return you to this lot after verification.
      </p>
      <SendVerificationEmailButton email={email} next={returnPath} className="mt-3 min-h-11" />
    </div>
  );
}
