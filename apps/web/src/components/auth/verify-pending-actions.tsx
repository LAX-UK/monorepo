"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useState } from "react";

export function VerifyPendingActions({ email, next }: { email: string; next?: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    setStatus(null);
    const nextQs =
      next?.startsWith("/") && !next.startsWith("//") ? `&next=${encodeURIComponent(next)}` : "";
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `/verify-email?email=${encodeURIComponent(email)}${nextQs}`,
    });
    setPending(false);
    setStatus(error ? "Could not resend right now. Please try again." : "Verification email sent.");
  }

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={resend} disabled={pending}>
        {pending ? "Sending..." : "Didn't get it? Send again"}
      </Button>
      {status ? (
        <p className="font-body text-sm text-on-surface-variant" aria-live="polite">
          {status}
        </p>
      ) : null}
      <Link
        href="/register"
        className="font-footer-links text-sm font-medium text-brand-900 underline decoration-brand-900 underline-offset-2 dark:text-primary"
      >
        Wrong address? Sign up again
      </Link>
    </div>
  );
}
