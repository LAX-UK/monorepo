"use client";

import { sendVerificationEmailFromBanner } from "@/lib/auth/services/send-verification-email.service";
import type { SessionUser } from "@/lib/data/contracts";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

export function EmailStatusBanner({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const dismissKey = useMemo(
    () =>
      `email-status:${user.id}:${String(user.emailStatusChangedAt ?? user.emailStatus ?? "ok")}`,
    [user.emailStatus, user.emailStatusChangedAt, user.id],
  );

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  if (dismissed) {
    return null;
  }

  if (user.emailStatus === "bounced" || user.emailStatus === "complained") {
    return (
      <BannerShell dismissKey={dismissKey} onDismiss={() => setDismissed(true)} tone="error">
        <p>
          We could not deliver email to your current address.{" "}
          <Link
            href="/dashboard/settings/account"
            className="font-medium text-brand-900 underline decoration-brand-900 underline-offset-2 dark:text-primary"
            prefetch
          >
            Update your email address
          </Link>
          .
        </p>
      </BannerShell>
    );
  }

  if (user.emailVerified === false) {
    return (
      <BannerShell dismissKey={dismissKey} onDismiss={() => setDismissed(true)} tone="info">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Verify your email to keep account recovery and bidding alerts working.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 shrink-0"
            onClick={() => {
              const next =
                pathname?.startsWith("/") &&
                !pathname.startsWith("//") &&
                (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))
                  ? pathname
                  : "/dashboard";
              void sendVerificationEmailFromBanner({ email: user.email, next }).then((result) => {
                if (!result.ok) {
                  notify.error(result.message);
                  return;
                }
                notify.success("Verification email sent");
              });
            }}
          >
            Send a new link
          </Button>
        </div>
      </BannerShell>
    );
  }

  return null;
}

function BannerShell({
  children,
  dismissKey,
  onDismiss,
  tone,
}: {
  children: ReactNode;
  dismissKey: string;
  onDismiss: () => void;
  tone: "error" | "info";
}) {
  return (
    <div
      className={
        tone === "error"
          ? "mb-6 flex items-start justify-between gap-4 rounded-sm border border-error/40 bg-error-container/20 px-4 py-3 font-body text-sm text-on-surface"
          : "mb-6 flex items-start justify-between gap-4 rounded-sm border border-primary/30 bg-primary-container/30 px-4 py-3 font-body text-sm text-on-surface"
      }
    >
      <div className="min-w-0 flex-1">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 shrink-0 text-on-surface-variant"
        onClick={() => {
          window.sessionStorage.setItem(dismissKey, "1");
          onDismiss();
        }}
        aria-label="Dismiss email status message"
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
