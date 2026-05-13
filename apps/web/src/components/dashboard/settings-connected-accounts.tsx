"use client";

import { ProviderMark } from "@/components/auth/provider-mark";
import { SettingsSection } from "@/components/dashboard/settings-section";
import {
  type LinkableProvider,
  useConnectedAccounts,
} from "@/lib/auth/hooks/use-connected-accounts";
import { notify } from "@/lib/ui/notify";
import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Skeleton } from "@auction/ui/components/skeleton";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { type SetupPasswordFormValues, setupPasswordFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

const APPLE_ENABLED = process.env.NEXT_PUBLIC_APPLE_ENABLED === "true";

type RowProps = {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  connected: boolean;
  meta?: string | undefined;
  primaryAction?: React.ReactNode | undefined;
  helper?: React.ReactNode | undefined;
};

function ProviderRow({
  title,
  description,
  Icon,
  connected,
  meta,
  primaryAction,
  helper,
}: RowProps) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high/60 ring-1 ring-outline-variant/30">
          <Icon className="size-4 text-on-surface" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-headline text-sm font-semibold text-on-surface">{title}</p>
            <StatusBadge variant={connected ? "success" : "neutral"}>
              {connected ? "Connected" : "Not connected"}
            </StatusBadge>
          </div>
          <p className="mt-1 font-body text-sm text-on-surface-variant">{description}</p>
          {meta ? (
            <p className="mt-1 font-label text-[11px] uppercase tracking-widest text-on-surface-variant/80">
              {meta}
            </p>
          ) : null}
          {helper}
        </div>
      </div>
      {primaryAction ? (
        <div className="flex shrink-0 items-center gap-2">{primaryAction}</div>
      ) : null}
    </li>
  );
}

function formatLinkedSince(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type SetupPasswordInlineFormProps = {
  pending: boolean;
  onSubmit: (values: SetupPasswordFormValues) => Promise<void>;
  onCancel: () => void;
};

function SetupPasswordInlineForm({ pending, onSubmit, onCancel }: SetupPasswordInlineFormProps) {
  const form = useForm<SetupPasswordFormValues>({
    resolver: zodResolver(setupPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="mt-3 flex flex-col gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="setup-password-new"
          className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
        >
          New password
        </label>
        <input
          id="setup-password-new"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          className="min-h-11 rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
          {...form.register("newPassword")}
        />
        {form.formState.errors.newPassword ? (
          <p className="font-body text-xs text-error">
            {form.formState.errors.newPassword.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="setup-password-confirm"
          className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
        >
          Confirm password
        </label>
        <input
          id="setup-password-confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          className="min-h-11 rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="font-body text-xs text-error">
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Connected accounts settings section. Manages password setup and
 * link/unlink for trusted social providers via Better Auth's own routes.
 */
export function SettingsConnectedAccounts({
  userEmail,
}: {
  userEmail: string;
}) {
  const router = useRouter();
  const {
    state,
    loading,
    refreshing,
    error,
    refresh,
    canUnlink,
    linkSocial,
    unlinkAccount,
    setupPassword,
  } = useConnectedAccounts();
  const [busy, setBusy] = useState<string | null>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);

  /** Whether to render the Apple row at all. We honour the public env
   * flag, but if the user has Apple linked (e.g. flag was on at signup
   * and is now off), we still show the row so they can disconnect.
   */
  const showAppleRow = APPLE_ENABLED || Boolean(state.apple);

  const handleLink = async (provider: LinkableProvider) => {
    setBusy(provider);
    const result = await linkSocial(provider);
    setBusy(null);
    if (!result.ok) notify.error(result.error);
    // On success Better Auth navigates the browser to the IdP; nothing more to do.
  };

  const handleUnlink = async (providerId: LinkableProvider, label: string) => {
    if (!canUnlink(providerId)) {
      notify.warning("Set a password first", {
        description: `Add a password before disconnecting ${label}, otherwise you will not be able to sign in.`,
      });
      return;
    }
    setBusy(providerId);
    const result = await unlinkAccount(providerId);
    setBusy(null);
    if (!result.ok) notify.error(result.error);
    else notify.success(`Disconnected ${label}`);
  };

  const handleSetup = async (values: SetupPasswordFormValues) => {
    setBusy("credential");
    const result = await setupPassword(values.newPassword);
    setBusy(null);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    setShowSetupForm(false);
    // Drive the in-page banner via the same URL contract used for
    // `?linked=google|apple` so the settings tab has one success-banner
    // mechanism instead of two.
    router.replace("/dashboard/settings?tab=security&password=set", { scroll: false });
  };

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
      <SettingsSection
        title="Connected accounts"
        titleAs="h3"
        eyebrow
        bordered={false}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="Refresh connected accounts"
            className="gap-2"
          >
            <RefreshCcw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        }
      >
        <p className="font-body text-sm text-on-surface-variant">
          Sign in with any of these methods using <span className="font-medium">{userEmail}</span>.
          We protect your account by refusing to remove the only remaining method.
        </p>

        {error ? (
          <Alert variant="destructive" role="alert" className="mt-4">
            <AlertTitle>Could not load connected accounts</AlertTitle>
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* While the first load is in flight we render skeletons; once we
            have ever loaded successfully we keep the previous rows visible
            during background refreshes to avoid a flash of "Not connected"
            rows after a disconnect. A first-load failure surfaces the
            error alert above + skeletons (no misleading empty rows). */}
        {loading || (error && state.totalMethods === 0) ? (
          <ul className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="rounded-lg border border-outline-variant/15 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-3/4" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-4 space-y-3">
            <ProviderRow
              title="Password"
              description="Sign in with your email and a password."
              Icon={KeyRound}
              connected={state.hasPassword}
              meta={undefined}
              primaryAction={
                state.hasPassword ? (
                  <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Active
                  </span>
                ) : showSetupForm ? null : (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => setShowSetupForm(true)}
                  >
                    Set a password
                  </Button>
                )
              }
              helper={
                !state.hasPassword && showSetupForm ? (
                  <SetupPasswordInlineForm
                    pending={busy === "credential"}
                    onSubmit={handleSetup}
                    onCancel={() => setShowSetupForm(false)}
                  />
                ) : null
              }
            />

            <ProviderRow
              title="Google"
              description="Single sign-on with your Google account."
              Icon={() => <ProviderMark provider="google" className="size-4" />}
              connected={Boolean(state.google)}
              meta={
                state.google ? `Linked ${formatLinkedSince(state.google.createdAt)}` : undefined
              }
              primaryAction={
                state.google ? (
                  <DisconnectButton
                    providerId="google"
                    label="Google"
                    canUnlink={canUnlink("google")}
                    busy={busy === "google"}
                    onClick={() => void handleUnlink("google", "Google")}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleLink("google")}
                    disabled={busy !== null}
                    aria-busy={busy === "google"}
                  >
                    {busy === "google" ? (
                      <>
                        <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                        Redirecting…
                      </>
                    ) : (
                      "Connect Google"
                    )}
                  </Button>
                )
              }
            />

            {showAppleRow ? (
              <ProviderRow
                title="Apple"
                description="Single sign-on with your Apple ID."
                Icon={() => <ProviderMark provider="apple" className="size-4" />}
                connected={Boolean(state.apple)}
                meta={
                  state.apple ? `Linked ${formatLinkedSince(state.apple.createdAt)}` : undefined
                }
                primaryAction={
                  state.apple ? (
                    <DisconnectButton
                      providerId="apple"
                      label="Apple"
                      canUnlink={canUnlink("apple")}
                      busy={busy === "apple"}
                      onClick={() => void handleUnlink("apple", "Apple")}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleLink("apple")}
                      disabled={busy !== null}
                      aria-busy={busy === "apple"}
                    >
                      {busy === "apple" ? (
                        <>
                          <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                          Redirecting…
                        </>
                      ) : (
                        "Connect Apple"
                      )}
                    </Button>
                  )
                }
              />
            ) : null}
          </ul>
        )}
      </SettingsSection>
    </div>
  );
}

type DisconnectButtonProps = {
  providerId: string;
  label: string;
  canUnlink: boolean;
  busy: boolean;
  onClick: () => void;
};

function DisconnectButton({
  providerId: _,
  label,
  canUnlink,
  busy,
  onClick,
}: DisconnectButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!canUnlink || busy}
      aria-busy={busy}
      title={canUnlink ? undefined : "Set a password first"}
      onClick={onClick}
    >
      {busy ? (
        <>
          <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
          Disconnecting…
        </>
      ) : (
        `Disconnect ${label}`
      )}
    </Button>
  );
}
