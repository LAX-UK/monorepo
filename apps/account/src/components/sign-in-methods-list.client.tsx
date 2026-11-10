"use client";

import { Button } from "@/components/account-button";
import {
  removeSignInMethodAction,
  startSignInMethodLinkAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult, LinkActionResult } from "@/server/domain/account-action-result";
import { buildReauthHref } from "@/server/domain/account-reauth";
import type { SettingsRowVm } from "@/server/domain/account-settings.vm";
import {
  type LinkRowVm,
  PROVIDER_LABEL,
  type SignInMethodRowVm,
  type SocialRowVm,
  buildRemoveConfirm,
} from "@/server/domain/account-sign-in-methods.vm";
import type { SocialSignInProvider } from "@auction/identity-contracts/account";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useState } from "react";
import { ListCard, ListCardRow, TAG } from "./account-ui";
import { ProductText } from "./product-name";
import { ProviderMark } from "./provider-mark";

/** A row of the list: the text, then its button beside it, or under it on a phone. */
const ROW =
  "flex min-h-16 flex-col items-start gap-y-2 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1 sm:px-6";

type SignInMethodsListProps = {
  rows: SignInMethodRowVm[];
  /** A line under the list when the person is one lost login away from being locked out. */
  hint: string | null;
  /** Where to come back to after a fresh sign-in, which removing a method may require. */
  returnTo: string;
  /** The password form, opened under the Password row by its Change button. */
  passwordPanel: ReactNode;
  /** Two-step verification, the last row: it opens the issuer's hosted page. */
  twoStep: SettingsRowVm;
};

function PasswordRow({
  row,
  panel,
}: {
  row: Extract<SignInMethodRowVm, { kind: "password" }>;
  panel: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className={ROW}>
        <RowText title={row.title} status={row.status} detail={row.detail} />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((shown) => !shown)}
        >
          {row.actionLabel}
        </Button>
      </div>
      <div id={panelId} hidden={!open} className="px-4 pt-1 pb-5 sm:px-6">
        {panel}
      </div>
    </li>
  );
}

function RowText({
  title,
  status,
  detail,
  detailMore,
  provider,
}: {
  title: string;
  status?: string;
  detail: ReactNode;
  /** Said after the detail from the small-tablet width up. */
  detailMore?: string;
  provider?: SocialSignInProvider;
}) {
  return (
    <div className="min-w-0 sm:flex-1 sm:basis-48">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-surface">
        {provider ? <ProviderMark provider={provider} /> : null}
        {title}
        {status ? <span className={TAG}>{status}</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        {detail}
        {detailMore ? <span className="hidden sm:inline"> {detailMore}</span> : null}
      </p>
    </div>
  );
}

function SocialRow({
  row,
  onRemove,
  disabled,
}: {
  row: SocialRowVm;
  onRemove: () => void;
  disabled: boolean;
}) {
  const reasonId = useId();
  return (
    <li className={ROW}>
      <RowText
        title={row.title}
        provider={row.provider}
        detail={
          <>
            {row.address ? <span className="break-words">{row.address} · </span> : null}
            <span className="whitespace-nowrap">{row.linkedOn}</span>
          </>
        }
      />
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        aria-label={`Remove ${row.title} sign-in`}
        disabled={disabled || row.blockedReason !== null}
        aria-describedby={row.blockedReason ? reasonId : undefined}
        onClick={onRemove}
      >
        Remove
      </Button>
      {row.blockedReason ? (
        <p id={reasonId} className="sm:order-last sm:basis-full text-xs text-on-surface-variant">
          {row.blockedReason}
        </p>
      ) : null}
    </li>
  );
}

function LinkRow({
  row,
  busy,
  disabled,
  error,
  onLink,
}: {
  row: LinkRowVm;
  busy: boolean;
  disabled: boolean;
  error: string | null;
  onLink: () => void;
}) {
  const errorId = useId();
  return (
    <li className={ROW}>
      <RowText
        title={row.title}
        detail={row.detail}
        detailMore={row.detailMore}
        provider={row.provider}
      />
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        disabled={disabled}
        aria-busy={busy}
        aria-describedby={error ? errorId : undefined}
        onClick={onLink}
      >
        {busy ? row.busyLabel : row.actionLabel}
      </Button>
      {error ? (
        <p id={errorId} role="alert" className="sm:order-last sm:basis-full text-xs text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The person's sign-in methods: a confirmed Remove for each linked Google or Apple account, and a
 * Link button for each one that is not linked and is offered, which hands the browser to the
 * issuer's own page.
 * The password row opens the password form in place, which changes the password or adds the first
 * one; two-step verification is the last row.
 */
export function SignInMethodsList({
  rows,
  hint,
  returnTo,
  passwordPanel,
  twoStep,
}: SignInMethodsListProps) {
  const router = useRouter();
  const [target, setTarget] = useState<SocialRowVm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The provider whose Link button was pressed: the browser is on its way to the issuer. */
  const [linking, setLinking] = useState<SocialSignInProvider | null>(null);
  const [linkError, setLinkError] = useState<{
    provider: SocialSignInProvider;
    message: string;
  } | null>(null);

  // Coming back with the browser's Back button restores this page as it was left, mid-link.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) setLinking(null);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  async function link(provider: SocialSignInProvider) {
    setNotice(null);
    setLinkError(null);
    setLinking(provider);
    let result: LinkActionResult;
    try {
      result = await startSignInMethodLinkAction(provider);
    } catch {
      result = {
        status: "error",
        message: "We couldn't do that just now. Nothing was changed. Please try again in a moment.",
        refresh: false,
      };
    }
    if (result.status === "ok") {
      // Stay busy: the page is being replaced by the issuer's.
      window.location.assign(result.url);
      return;
    }
    if (result.status === "reauth_required") {
      window.location.assign(buildReauthHref(returnTo));
      return;
    }
    setLinking(null);
    setLinkError({ provider, message: result.message });
    if (result.refresh) router.refresh();
  }

  const confirm = target
    ? buildRemoveConfirm(
        target.provider,
        rows
          .filter((row): row is SocialRowVm => row.kind === "social")
          .filter((row) => row.provider !== target.provider)
          .map((row) => PROVIDER_LABEL[row.provider]),
      )
    : null;

  function close() {
    if (busy) return;
    setTarget(null);
    setError(null);
  }

  async function run(current: SocialRowVm) {
    setBusy(true);
    setError(null);
    let result: AccountActionResult;
    try {
      result = await removeSignInMethodAction(current.provider);
    } catch {
      result = { status: "error", message: "We couldn't do that just now. Please try again." };
    }
    if (result.status === "reauth_required") {
      window.location.assign(buildReauthHref(returnTo));
      return;
    }
    setBusy(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setTarget(null);
    setNotice(result.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ListCard>
        {rows.map((row) =>
          row.kind === "password" ? (
            <PasswordRow key="password" row={row} panel={passwordPanel} />
          ) : row.kind === "link" ? (
            <LinkRow
              key={`link-${row.provider}`}
              row={row}
              busy={linking === row.provider}
              disabled={linking !== null}
              error={linkError?.provider === row.provider ? linkError.message : null}
              onLink={() => link(row.provider)}
            />
          ) : (
            <SocialRow
              key={row.provider}
              row={row}
              disabled={linking !== null}
              onRemove={() => {
                setNotice(null);
                setLinkError(null);
                setTarget(row);
              }}
            />
          ),
        )}
        <ListCardRow
          title={twoStep.title}
          {...(twoStep.subtitle ? { subtitle: twoStep.subtitle } : {})}
          href={twoStep.href}
        />
      </ListCard>
      {hint ? <p className="px-4 text-xs text-on-surface-variant">{hint}</p> : null}
      <output aria-live="polite" className="block px-4 text-sm text-success empty:hidden">
        {notice}
      </output>
      {confirm && target ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title={confirm.title}
          body={
            <>
              <p>
                <ProductText text={confirm.body} />
              </p>
              {error ? (
                <p role="alert" className="mt-3 text-error">
                  {error}
                </p>
              ) : null}
            </>
          }
          confirmLabel={confirm.confirmLabel}
          loading={busy}
          onConfirm={() => run(target)}
        />
      ) : null}
    </div>
  );
}
