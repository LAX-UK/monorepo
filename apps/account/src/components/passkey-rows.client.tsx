"use client";

import { Button } from "@/components/account-button";
import { FIELD } from "@/components/account-ui";
import {
  removePasskeyAction,
  renamePasskeyAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult } from "@/server/domain/account-action-result";
import {
  type PasskeyItemVm,
  type PasskeysRowVm,
  passkeyNameProblem,
} from "@/server/domain/account-passkeys.vm";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { PASSKEY_NAME_INPUT_MAX_LENGTH } from "@auction/identity-contracts/account";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { useId, useState } from "react";
import { ProductText } from "./product-name";
import {
  SIGN_IN_METHOD_ROW,
  SIGN_IN_METHOD_SUBROW,
  SignInMethodRowText,
} from "./sign-in-method-row";

const COULD_NOT = "We couldn't do that just now. Please try again.";

/** Runs a passkey change, turning a thrown failure into the same plain error the issuer's would be. */
async function attempt(run: () => Promise<AccountActionResult>): Promise<AccountActionResult> {
  try {
    return await run();
  } catch {
    return { status: "error", message: COULD_NOT };
  }
}

function RenamePasskeyDialog({
  item,
  returnTo,
  onClose,
  onRenamed,
  onStale,
}: {
  item: PasskeyItemVm;
  returnTo: string;
  onClose: () => void;
  onRenamed: (message: string) => void;
  onStale: (message: string) => void;
}) {
  const fieldId = useId();
  const messageId = useId();
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const problem = passkeyNameProblem(name);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await attempt(() => renamePasskeyAction(item.id, name));
    if (result.status === "reauth_required") {
      // A rename needs no recent sign-in, but a sign-in that has ended has to start again.
      window.location.assign(buildReauthHref(returnTo));
      return;
    }
    if (result.status === "error" && result.stale) {
      // The passkey is already gone: say so and show the list as it is.
      onStale(result.message);
      return;
    }
    setBusy(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    onRenamed(result.message);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-md border-border-hairline">
        <DialogHeader>
          <DialogTitle>Rename passkey</DialogTitle>
          <DialogDescription>
            Added {item.addedOn} · {item.hint}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>Name</Label>
            <Input
              className={FIELD}
              id={fieldId}
              name="name"
              autoComplete="off"
              autoFocus
              value={name}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? messageId : undefined}
            />
            <p className="text-xs text-on-surface-variant">
              So you can tell your passkeys apart. Up to {PASSKEY_NAME_INPUT_MAX_LENGTH} characters.
            </p>
            {error ? (
              <p id={messageId} role="alert" className="text-sm text-error">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <LoadingButton type="submit" variant="cta" loading={busy} loadingLabel="Saving…">
              Save
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemovePasskeyDialog({
  item,
  returnTo,
  onClose,
  onRemoved,
  onStale,
}: {
  item: PasskeyItemVm;
  returnTo: string;
  onClose: () => void;
  onRemoved: (message: string) => void;
  onStale: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await attempt(() => removePasskeyAction(item.id));
    if (result.status === "reauth_required") {
      window.location.assign(buildReauthHref(returnTo, "remove_sign_in_method"));
      return;
    }
    if (result.status === "error" && result.stale) {
      // The page was out of date (already removed, or now the last way in): close and reload it,
      // so the dialog never promises a way in the row below says is not there.
      onStale(result.message);
      return;
    }
    setBusy(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    onRemoved(result.message);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={item.confirm.title}
      body={
        <>
          <p>
            <ProductText text={item.confirm.body} />
          </p>
          <p className="mt-3">{item.confirm.note}</p>
          {error ? (
            <p role="alert" className="mt-3 text-error">
              {error}
            </p>
          ) : null}
        </>
      }
      confirmLabel={item.confirm.confirmLabel}
      loading={busy}
      loadingLabel="Removing…"
      onConfirm={remove}
    />
  );
}

function PasskeyItemRow({
  item,
  disabled,
  onRename,
  onRemove,
}: {
  item: PasskeyItemVm;
  disabled: boolean;
  onRename: () => void;
  onRemove: () => void;
}) {
  const reasonId = useId();
  return (
    <li className={SIGN_IN_METHOD_SUBROW} data-passkey-id={item.id}>
      <SignInMethodRowText
        title={item.name}
        detail={
          <>
            {item.hint}
            <span className="hidden sm:inline"> · Added {item.addedOn}</span>
            {" · "}
            {item.lastUsed}
          </>
        }
      />
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={`Rename ${item.name}`}
          disabled={disabled}
          onClick={onRename}
        >
          Rename
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-label={`Remove ${item.name}`}
          disabled={disabled || item.blockedReason !== null}
          aria-describedby={item.blockedReason ? reasonId : undefined}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
      {item.blockedReason ? (
        <p id={reasonId} className="text-xs text-on-surface-variant sm:order-last sm:basis-full">
          {item.blockedReason}
        </p>
      ) : null}
    </li>
  );
}

type PasskeysGroupProps = {
  row: PasskeysRowVm;
  /** Where to come back to after a fresh sign-in, which removing a passkey may require. */
  returnTo: string;
  /** The browser is on its way to the issuer's page for this row's Add button. */
  adding: boolean;
  /** Some other hand-off is under way, so every button waits. */
  disabled: boolean;
  /** Why the issuer would not start adding one, when it would not. */
  addError: string | null;
  onAdd: () => void;
  /** A rename or removal went through: the list shows the message and reloads. */
  onChanged: (message: string) => void;
  /** The page was out of date: the list shows why and reloads. */
  onStale: (message: string) => void;
};

/**
 * The "Passkeys" row and the person's passkeys under it. Add hands the browser to the issuer, where
 * the passkey is made; Rename and Remove act on one passkey from a dialog. Every button names the
 * passkey it acts on, and Remove is disabled with its reason when it is the last way in.
 */
export function PasskeysGroup({
  row,
  returnTo,
  adding,
  disabled,
  addError,
  onAdd,
  onChanged,
  onStale,
}: PasskeysGroupProps) {
  const addReasonId = useId();
  const addErrorId = useId();
  const [renaming, setRenaming] = useState<PasskeyItemVm | null>(null);
  const [removing, setRemoving] = useState<PasskeyItemVm | null>(null);
  const addDescribedBy = [row.addBlockedReason ? addReasonId : null, addError ? addErrorId : null]
    .filter(Boolean)
    .join(" ");
  return (
    <li data-sign-in-method="passkeys">
      <div className={SIGN_IN_METHOD_ROW}>
        <SignInMethodRowText
          title={row.title}
          status={row.count > 0 ? String(row.count) : undefined}
          detail={row.detail}
          detailLong={row.detailLong}
        />
        <Button
          type="button"
          variant="cta"
          className="shrink-0"
          disabled={disabled || adding || row.addBlockedReason !== null}
          aria-busy={adding}
          aria-describedby={addDescribedBy || undefined}
          onClick={onAdd}
        >
          {adding ? row.busyLabel : row.addLabel}
        </Button>
        {row.addBlockedReason ? (
          <p
            id={addReasonId}
            className="text-xs text-on-surface-variant sm:order-last sm:basis-full"
          >
            {row.addBlockedReason}
          </p>
        ) : null}
        {addError ? (
          <p
            id={addErrorId}
            role="alert"
            className="text-xs text-error sm:order-last sm:basis-full"
          >
            {addError}
          </p>
        ) : null}
      </div>
      {row.items.length > 0 ? (
        <ul className="divide-y divide-border-hairline border-t border-border-hairline">
          {row.items.map((item) => (
            <PasskeyItemRow
              key={item.id}
              item={item}
              disabled={disabled || adding}
              onRename={() => setRenaming(item)}
              onRemove={() => setRemoving(item)}
            />
          ))}
        </ul>
      ) : null}
      {renaming ? (
        <RenamePasskeyDialog
          item={renaming}
          returnTo={returnTo}
          onClose={() => setRenaming(null)}
          onRenamed={(message) => {
            setRenaming(null);
            onChanged(message);
          }}
          onStale={(message) => {
            setRenaming(null);
            onStale(message);
          }}
        />
      ) : null}
      {removing ? (
        <RemovePasskeyDialog
          item={removing}
          returnTo={returnTo}
          onClose={() => setRemoving(null)}
          onRemoved={(message) => {
            setRemoving(null);
            onChanged(message);
          }}
          onStale={(message) => {
            setRemoving(null);
            onStale(message);
          }}
        />
      ) : null}
    </li>
  );
}
