"use client";

import { Button } from "@/components/account-button";
import { removeSignInMethodAction } from "@/server/application/account-identity-actions.server";
import type { AccountActionResult } from "@/server/domain/account-action-result";
import { buildReauthHref } from "@/server/domain/account-reauth";
import {
  PROVIDER_LABEL,
  type SignInMethodRowVm,
  type SocialRowVm,
  buildRemoveConfirm,
} from "@/server/domain/account-sign-in-methods.vm";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { LIST_ROW, ListCard, TAG } from "./account-ui";
import { ProductText } from "./product-name";

type SignInMethodsListProps = {
  rows: SignInMethodRowVm[];
  /** A line under the list when the person is one lost login away from being locked out. */
  hint: string | null;
  /** Where to come back to after a fresh sign-in, which removing a method may require. */
  returnTo: string;
};

function RowText({ title, status, detail }: { title: string; status?: string; detail: string }) {
  return (
    <div className="min-w-0 flex-1 basis-48">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-surface">
        {title}
        {status ? <span className={TAG}>{status}</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">{detail}</p>
    </div>
  );
}

function SocialRow({ row, onRemove }: { row: SocialRowVm; onRemove: () => void }) {
  const reasonId = useId();
  return (
    <li className={LIST_ROW}>
      <RowText title={row.title} detail={row.detail} />
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        aria-label={`Remove ${row.title} sign-in`}
        disabled={row.blockedReason !== null}
        aria-describedby={row.blockedReason ? reasonId : undefined}
        onClick={onRemove}
      >
        Remove
      </Button>
      {row.blockedReason ? (
        <p id={reasonId} className="order-last basis-full text-xs text-on-surface-variant">
          {row.blockedReason}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The person's sign-in methods, with a confirmed Remove for each linked Google or Apple account.
 * The password row leads to the password form further down the page, which already changes the
 * password or adds the first one.
 */
export function SignInMethodsList({ rows, hint, returnTo }: SignInMethodsListProps) {
  const router = useRouter();
  const [target, setTarget] = useState<SocialRowVm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
            <li key="password" className={LIST_ROW}>
              <RowText title={row.title} status={row.status} detail={row.detail} />
              <Button asChild variant="outline" className="shrink-0">
                <a href={row.actionHref}>{row.actionLabel}</a>
              </Button>
            </li>
          ) : (
            <SocialRow
              key={row.provider}
              row={row}
              onRemove={() => {
                setNotice(null);
                setTarget(row);
              }}
            />
          ),
        )}
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
