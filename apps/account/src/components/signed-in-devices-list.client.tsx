"use client";

import { Button } from "@/components/account-button";
import {
  signOutDeviceAction,
  signOutOtherDevicesAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult } from "@/server/domain/account-action-result";
import { buildReauthHref } from "@/server/domain/account-reauth";
import {
  type SessionRowVm,
  type SessionsVm,
  buildSignOutDeviceConfirm,
  buildSignOutOthersConfirm,
} from "@/server/domain/account-sessions.vm";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LIST_ROW, ListCard, TAG } from "./account-ui";
import { ProductText } from "./product-name";

type Target = { kind: "device"; row: SessionRowVm } | { kind: "others" };

type SignedInDevicesListProps = {
  sessions: SessionsVm;
  /** Where to come back to after a fresh sign-in, which signing a device out may require. */
  returnTo: string;
};

function DeviceRow({ row, onSignOut }: { row: SessionRowVm; onSignOut?: () => void }) {
  return (
    <li className={LIST_ROW}>
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-surface">
          {row.deviceLabel}
          {row.isCurrent ? <span className={TAG}>This device</span> : null}
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant">{row.detail}</p>
      </div>
      {onSignOut ? (
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          aria-label={`Sign out ${row.deviceLabel}`}
          onClick={onSignOut}
        >
          Sign out
        </Button>
      ) : null}
    </li>
  );
}

/**
 * The person's signed-in devices, with a confirmed Sign out per device and for all the others.
 * This device is listed but never offered for sign-out (the header's Sign out does that).
 */
export function SignedInDevicesList({ sessions, returnTo }: SignedInDevicesListProps) {
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const confirm =
    target?.kind === "device"
      ? buildSignOutDeviceConfirm(target.row)
      : target?.kind === "others"
        ? buildSignOutOthersConfirm(sessions.others.length)
        : null;

  function close() {
    if (busy) return;
    setTarget(null);
    setError(null);
  }

  async function run(current: Target) {
    setBusy(true);
    setError(null);
    let result: AccountActionResult;
    try {
      result =
        current.kind === "device"
          ? await signOutDeviceAction(current.row.id)
          : await signOutOtherDevicesAction();
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
        {sessions.current ? <DeviceRow row={sessions.current} /> : null}
        {sessions.others.map((row) => (
          <DeviceRow
            key={row.id}
            row={row}
            onSignOut={() => {
              setNotice(null);
              setTarget({ kind: "device", row });
            }}
          />
        ))}
      </ListCard>
      {sessions.others.length === 0 ? (
        <p className="text-xs text-on-surface-variant">You're not signed in on any other device.</p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => {
            setNotice(null);
            setTarget({ kind: "others" });
          }}
        >
          Sign out everywhere else
        </Button>
      )}
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
