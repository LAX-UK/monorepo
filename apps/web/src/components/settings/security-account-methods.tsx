"use client";

import { SecurityPasswordForm } from "@/components/auth/security-password-form";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { SettingsConnectedAccounts } from "@/components/settings/settings-connected-accounts";
import { useConnectedAccounts } from "@/lib/auth/hooks/use-connected-accounts";
import { computeSignInMethods } from "@/lib/auth/sign-in-methods";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Skeleton } from "@auction/ui/components/skeleton";
import { useMemo } from "react";

function PasswordStatus({ hasPassword }: { hasPassword: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-hairline bg-surface-container-high/20 px-4 py-3">
      <p className="font-body text-sm text-on-surface">Password</p>
      <span
        className={
          hasPassword
            ? "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-success"
            : "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
        }
      >
        {hasPassword ? "Set" : "Not set"}
      </span>
    </div>
  );
}

type SecurityAccountMethodsProps = {
  emailVerified: boolean;
};

export function SecurityAccountMethods({ emailVerified }: SecurityAccountMethodsProps) {
  const connectedAccounts = useConnectedAccounts();
  const { state, loading, error, refresh } = connectedAccounts;
  const passwordFirstLoadFailed = !loading && error != null && state.accounts.length === 0;

  const signInMethods = useMemo(
    () => computeSignInMethods({ state, emailVerified }),
    [state, emailVerified],
  );

  return (
    <div className="space-y-8">
      <section id="password-setup" className="scroll-mt-24 space-y-4">
        <div className="space-y-1">
          <h3 className="font-headline text-base font-semibold text-on-surface">Password</h3>
          <p className="font-body text-sm text-on-surface-variant">
            {state.hasPassword
              ? "Use a strong password you do not reuse on other sites."
              : "Add a password so you can sign in with email as well as linked accounts."}
          </p>
        </div>
        {loading ? (
          <Skeleton className="h-40 w-full" aria-label="Loading password settings" />
        ) : passwordFirstLoadFailed ? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-3">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <PasswordStatus hasPassword={state.hasPassword} />
            {state.hasPassword ? (
              <SecurityPasswordForm />
            ) : (
              <SetPasswordForm setupPassword={connectedAccounts.setupPassword} />
            )}
          </>
        )}
      </section>

      <section id="connected-accounts" className="scroll-mt-24 space-y-4">
        <div className="space-y-1">
          <h3 className="font-headline text-base font-semibold text-on-surface">
            Connected accounts
          </h3>
          <p className="font-body text-sm text-on-surface-variant">
            Link Google or Apple to sign in without a password. Your provider email must be verified
            and match your LAX account email.
          </p>
        </div>
        <SettingsConnectedAccounts
          state={connectedAccounts.state}
          loading={connectedAccounts.loading}
          error={connectedAccounts.error}
          canUnlink={signInMethods.canUnlink}
          linkSocial={connectedAccounts.linkSocial}
          unlinkAccount={connectedAccounts.unlinkAccount}
          magicLinkAvailable={signInMethods.magicLinkAvailable}
          signInMethodCount={signInMethods.totalMethods}
          remainingSignInMethodLabels={signInMethods.remainingSignInMethodLabels}
        />
      </section>
    </div>
  );
}
