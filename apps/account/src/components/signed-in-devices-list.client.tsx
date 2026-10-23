"use client";

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
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { InsetGroup } from "@auction/ui/components/inset-group";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Target = { kind: "device"; row: SessionRowVm } | { kind: "others" };

type SignedInDevicesListProps = {
  sessions: SessionsVm;
  /** Where to come back to after a fresh sign-in, which signing a device out may require. */
  returnTo: string;
};

function DeviceRow({ row, onSignOut }: { row: SessionRowVm; onSignOut?: () => void }) {
  return (
    <li className="flex min-h-[var(--tap-target-min,44px)] flex-wrap items-center gap-3 border-b border-border-hairline px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-surface">
          {row.deviceLabel}
          {row.isCurrent ? (
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">
              This device
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant">{row.detail}</p>
      </div>
      {onSignOut ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0"
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
    <div className="space-y-3">
      <InsetGroup>
        <ul>
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
        </ul>
      </InsetGroup>
      {sessions.others.length === 0 ? (
        <p className="px-4 text-xs text-on-surface-variant">
          You're not signed in on any other device.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
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
              <p>{confirm.body}</p>
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
