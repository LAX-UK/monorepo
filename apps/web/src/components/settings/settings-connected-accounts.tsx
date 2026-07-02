"use client";

import { ProviderMark } from "@/components/auth/provider-mark";
import type {
  ConnectedAccountsActions,
  LinkableProvider,
} from "@/lib/auth/hooks/use-connected-accounts";
import { notify } from "@/lib/ui/notify";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Skeleton } from "@auction/ui/components/skeleton";
import Link from "next/link";
import { useState } from "react";

const APPLE_ENABLED = process.env.NEXT_PUBLIC_APPLE_ENABLED === "true";

const PROVIDER_LABEL: Record<LinkableProvider, string> = {
  google: "Google",
  apple: "Apple",
};

function MethodStatusRow({
  label,
  connected,
  detail,
}: {
  label: string;
  connected: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-hairline py-3 last:border-b-0">
      <div className="space-y-0.5">
        <p className="font-body text-sm font-medium text-on-surface">{label}</p>
        {detail ? <p className="font-body text-xs text-on-surface-variant">{detail}</p> : null}
      </div>
      <span
        className={
          connected
            ? "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-success"
            : "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
        }
      >
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

function ProviderRow({
  provider,
  linked,
  canDisconnect,
  disconnectDisabledReason,
  busy,
  onConnect,
  onDisconnect,
}: {
  provider: LinkableProvider;
  linked: boolean;
  canDisconnect: boolean;
  disconnectDisabledReason?: string | null;
  busy: LinkableProvider | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const label = PROVIDER_LABEL[provider];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <ProviderMark provider={provider} className="size-6 shrink-0" />
        <div>
          <p className="font-body text-sm font-medium text-on-surface">{label}</p>
          <p className="font-body text-xs text-on-surface-variant">
            {linked ? `Sign in with ${label}` : `Connect your ${label} account`}
          </p>
        </div>
      </div>
      {linked ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canDisconnect || busy !== null}
          title={!canDisconnect ? (disconnectDisabledReason ?? undefined) : undefined}
          aria-busy={busy === provider}
          onClick={onDisconnect}
        >
          {busy === provider ? "Disconnecting…" : "Disconnect"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondaryOutline"
          size="sm"
          disabled={busy !== null}
          aria-busy={busy === provider}
          onClick={onConnect}
        >
          {busy === provider ? "Connecting…" : "Connect"}
        </Button>
      )}
    </div>
  );
}

export type SettingsConnectedAccountsProps = Omit<ConnectedAccountsActions, "setupPassword"> & {
  magicLinkAvailable: boolean;
  signInMethodCount: number;
  remainingSignInMethodLabels: (exclude?: LinkableProvider) => string[];
};

export function SettingsConnectedAccounts({
  state,
  loading,
  error,
  canUnlink,
  linkSocial,
  unlinkAccount,
  magicLinkAvailable,
  signInMethodCount,
  remainingSignInMethodLabels,
}: SettingsConnectedAccountsProps) {
  const [pending, setPending] = useState<LinkableProvider | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<LinkableProvider | null>(null);

  const handleConnect = async (provider: LinkableProvider) => {
    setActionError(null);
    setPending(provider);
    const result = await linkSocial(provider);
    setPending(null);
    if (!result.ok) {
      const message =
        result.error.toLowerCase().includes("email") ||
        result.error.toLowerCase().includes("verified")
          ? "Linking only works when the provider email is verified and matches your LAX account email."
          : result.error;
      setActionError(message);
      notify.error(message);
    }
  };

  const handleDisconnect = async (provider: LinkableProvider) => {
    setActionError(null);
    setPending(provider);
    const result = await unlinkAccount(provider);
    setPending(null);
    setDisconnectTarget(null);
    if (!result.ok) {
      setActionError(result.error);
      notify.error(result.error);
      return;
    }
    notify.success(`${PROVIDER_LABEL[provider]} disconnected`);
  };

  const disconnectDisabledReason =
    signInMethodCount <= 1 ? "You need at least one sign-in method on your account." : null;

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading connected accounts">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const remainingAfterDisconnect = disconnectTarget
    ? remainingSignInMethodLabels(disconnectTarget)
    : [];

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <ProviderRow
          provider="google"
          linked={state.google != null}
          canDisconnect={canUnlink("google")}
          disconnectDisabledReason={disconnectDisabledReason}
          busy={pending}
          onConnect={() => void handleConnect("google")}
          onDisconnect={() => setDisconnectTarget("google")}
        />
        {APPLE_ENABLED ? (
          <ProviderRow
            provider="apple"
            linked={state.apple != null}
            canDisconnect={canUnlink("apple")}
            disconnectDisabledReason={disconnectDisabledReason}
            busy={pending}
            onConnect={() => void handleConnect("apple")}
            onDisconnect={() => setDisconnectTarget("apple")}
          />
        ) : null}
      </div>

      {magicLinkAvailable && state.google != null && !state.hasPassword && canUnlink("google") ? (
        <p className="font-body text-xs text-on-surface-variant">
          You can disconnect Google and still sign in with an email link. Consider setting a
          password under Sign-in methods for another option.
        </p>
      ) : null}
      {magicLinkAvailable && state.apple != null && !state.hasPassword && canUnlink("apple") ? (
        <p className="font-body text-xs text-on-surface-variant">
          You can disconnect Apple and still sign in with an email link. Consider setting a password
          under Sign-in methods for another option.
        </p>
      ) : null}

      <div className="rounded-lg border border-border-hairline bg-surface-container-high/20 px-4 py-2">
        <p className="mb-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Sign-in methods overview
        </p>
        <MethodStatusRow
          label="Email sign-in link"
          connected={magicLinkAvailable}
          detail={
            magicLinkAvailable ? "Active for your verified email" : "Verify your email to enable"
          }
        />
        <MethodStatusRow
          label="Email and password"
          connected={state.hasPassword}
          detail={state.hasPassword ? "Password is set" : "No password yet"}
        />
        <MethodStatusRow label="Google" connected={state.google != null} />
        {APPLE_ENABLED ? <MethodStatusRow label="Apple" connected={state.apple != null} /> : null}
        <p className="border-b border-border-hairline py-3 font-body text-xs text-on-surface-variant last:border-b-0">
          Phone number — managed on your{" "}
          <Link
            href="/dashboard/settings/profile"
            className="text-link underline-offset-2 hover:underline"
          >
            Profile settings
          </Link>
          .
        </p>
        <p className="pt-2 font-body text-xs text-on-surface-variant">
          Two-factor authentication is managed below.
        </p>
      </div>

      <Dialog
        open={disconnectTarget != null}
        onOpenChange={(open) => {
          if (!open && pending == null) setDisconnectTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Disconnect {disconnectTarget ? PROVIDER_LABEL[disconnectTarget] : "account"}?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 font-body text-sm text-on-surface-variant">
                <p>
                  You will no longer be able to sign in with{" "}
                  {disconnectTarget ? PROVIDER_LABEL[disconnectTarget] : "this provider"} on this
                  account.
                </p>
                {remainingAfterDisconnect.length > 0 ? (
                  <div>
                    <p className="font-medium text-on-surface">
                      You will still be able to sign in with:
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {remainingAfterDisconnect.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending != null}
              onClick={() => setDisconnectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending != null || disconnectTarget == null}
              onClick={() => {
                if (disconnectTarget) void handleDisconnect(disconnectTarget);
              }}
            >
              {pending != null ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
