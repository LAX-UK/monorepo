"use client";

import { AUTH_FOOTER_LINK_ROW } from "@/lib/auth/auth-link-classes";
import { useResendCooldown } from "@/lib/auth/hooks/use-resend-cooldown";
import { resendVerificationEmailFromPending } from "@/lib/auth/services/send-verification-email.service";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useState } from "react";

export function VerifyPendingActions({ email, next }: { email: string; next?: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { remaining: cooldown, start: startCooldown } = useResendCooldown(45);

  async function resend() {
    if (cooldown > 0 || pending) return;
    setPending(true);
    setStatus(null);
    const result = await resendVerificationEmailFromPending({
      email,
      next: next ?? null,
      webOrigin: window.location.origin,
    });
    if (!result.ok) {
      setStatus(result.message);
    } else {
      setStatus("Verification email sent.");
      startCooldown(45);
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={() => void resend()} disabled={pending || cooldown > 0}>
        {pending
          ? "Sending..."
          : cooldown > 0
            ? `Resend available in ${cooldown}s`
            : "Didn't get it? Send again"}
      </Button>
      {status ? (
        <output className="font-body text-sm text-on-surface-variant" aria-live="polite">
          {status}
        </output>
      ) : null}
      <Link href="/login" className={AUTH_FOOTER_LINK_ROW}>
        Try a different email (return to sign in)
      </Link>
      <Link href="/register" className={AUTH_FOOTER_LINK_ROW}>
        Wrong address? Sign up again
      </Link>
    </div>
  );
}
