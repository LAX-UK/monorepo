"use client";

import { Button } from "@/components/account-button";
import {
  removeSignInMethodAction,
  startSignInMethodAddAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult, LinkActionResult } from "@/server/domain/account-action-result";
import { buildReauthHref } from "@/server/domain/account-reauth";
import type { SettingsRowVm } from "@/server/domain/account-settings.vm";
import type {
  LinkRowVm,
  SignInMethodRowVm,
  SocialRowVm,
} from "@/server/domain/account-sign-in-methods.vm";
import type { SignInMethodKind } from "@auction/identity-contracts/account";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useState } from "react";
import { ListCard, ListCardRow } from "./account-ui";
import { PasskeysGroup } from "./passkey-rows.client";
import { ProductText } from "./product-name";
import { SIGN_IN_METHOD_ROW as ROW, SignInMethodRowText as RowText } from "./sign-in-method-row";

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
 * The person's sign-in methods: the password, the passkeys (each with Rename and a confirmed
 * Remove, and an Add button), a confirmed Remove for each linked Google or Apple account, and a
 * Link button for each one that is not linked and is offered. Add and Link hand the browser to the
 * issuer's own page, where the method is made.
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
  /** The method whose Add or Link button was pressed: the browser is on its way to the issuer. */
  const [adding, setAdding] = useState<SignInMethodKind | null>(null);
  const [addError, setAddError] = useState<{ kind: SignInMethodKind; message: string } | null>(
    null,
  );

  // Coming back with the browser's Back button restores this page as it was left, mid-hand-off.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) setAdding(null);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  async function add(kind: SignInMethodKind) {
    setNotice(null);
    setAddError(null);
    setAdding(kind);
    let result: LinkActionResult;
    try {
      result = await startSignInMethodAddAction(kind);
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
      window.location.assign(buildReauthHref(returnTo, "add_sign_in_method"));
      return;
    }
    setAdding(null);
    setAddError({ kind, message: result.message });
    if (result.refresh) router.refresh();
  }

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
      window.location.assign(buildReauthHref(returnTo, "remove_sign_in_method"));
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
        {rows.map((row) => {
          switch (row.kind) {
            case "password":
              return <PasswordRow key="password" row={row} panel={passwordPanel} />;
            case "passkeys":
              return (
                <PasskeysGroup
                  key="passkeys"
                  row={row}
                  returnTo={returnTo}
                  adding={adding === "passkey"}
                  disabled={adding !== null}
                  addError={addError?.kind === "passkey" ? addError.message : null}
                  onAdd={() => add("passkey")}
                  onChanged={(message) => {
                    setAddError(null);
                    setNotice(message);
                    router.refresh();
                  }}
                />
              );
            case "link":
              return (
                <LinkRow
                  key={`link-${row.provider}`}
                  row={row}
                  busy={adding === row.provider}
                  disabled={adding !== null}
                  error={addError?.kind === row.provider ? addError.message : null}
                  onLink={() => add(row.provider)}
                />
              );
            case "social":
              return (
                <SocialRow
                  key={row.provider}
                  row={row}
                  disabled={adding !== null}
                  onRemove={() => {
                    setNotice(null);
                    setAddError(null);
                    setTarget(row);
                  }}
                />
              );
          }
        })}
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
      {target ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title={target.confirm.title}
          body={
            <>
              <p>
                <ProductText text={target.confirm.body} />
              </p>
              {error ? (
                <p role="alert" className="mt-3 text-error">
                  {error}
                </p>
              ) : null}
            </>
          }
          confirmLabel={target.confirm.confirmLabel}
          loading={busy}
          loadingLabel="Removing…"
          onConfirm={() => run(target)}
        />
      ) : null}
    </div>
  );
}
