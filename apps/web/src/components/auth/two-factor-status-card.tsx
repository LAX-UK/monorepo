"use client";

import { TwoFactorDisableDialog } from "@/components/auth/two-factor-disable-dialog";
import { TwoFactorRegenerateCodesDialog } from "@/components/auth/two-factor-regenerate-codes-dialog";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type TwoFactorStatusCardProps = {
  twoFactorEnabled: boolean;
};

export function TwoFactorStatusCard({ twoFactorEnabled }: TwoFactorStatusCardProps) {
  const router = useRouter();
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  return (
    <>
      <Surface variant="section" padding="md" className="space-y-4">
        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-headline text-lg font-semibold text-on-surface">
              Two-factor authentication
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              Add a second step at sign-in with an authenticator app (TOTP). Recommended for staff
              and anyone bidding regularly.
            </p>
          </div>
          <StatusBadge variant={twoFactorEnabled ? "success" : "warning"}>
            {twoFactorEnabled ? "On" : "Off"}
          </StatusBadge>
        </div>
        <div className="space-y-4 font-body text-sm text-on-surface-variant">
          {twoFactorEnabled ? (
            <>
              <p>
                You&apos;ll be asked for a 6-digit code when you sign in on a new device or browser.
                Keep backup codes somewhere safe offline.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondaryOutline" onClick={() => setRegenOpen(true)}>
                  Regenerate backup codes
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDisableOpen(true)}>
                  Turn off 2FA
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>Protect your account with a code from an authenticator app after your password.</p>
              <Button type="button" variant="primary" asChild>
                <Link href="/dashboard/settings/security/two-factor">Set up two-factor</Link>
              </Button>
            </>
          )}
        </div>
      </Surface>

      <TwoFactorDisableDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        onDisabled={() => {
          router.refresh();
        }}
      />
      <TwoFactorRegenerateCodesDialog open={regenOpen} onOpenChange={setRegenOpen} />
    </>
  );
}
