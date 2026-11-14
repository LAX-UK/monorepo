"use client";

import { Button } from "@/components/account-button";
import { RESUME_QUERY, STEP_UP_COPY, withoutResume } from "@/lib/step-up";
import {
  signOutDeviceAction,
  signOutOtherDevicesAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult } from "@/server/domain/account-action-result";
import {
  NO_OTHER_DEVICES,
  SIGN_OUT_OTHERS_RESUME,
  type SessionRowVm,
  type SessionsVm,
  buildSignOutDeviceConfirm,
  buildSignOutOthersConfirm,
  buildSignedOutDeviceMessage,
  buildSignedOutOthersMessage,
  parseDevicesResume,
  showMoreDevicesLabel,
  signOutDeviceResume,
  splitOtherDevices,
} from "@/server/domain/account-sessions.vm";
import { cn } from "@auction/ui";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { type Ref, useEffect, useRef, useState } from "react";
import { ListCard, TAG } from "./account-ui";
import { DeviceKindIcon } from "./device-kind-icon";
import { ProductText } from "./product-name";
import { useStepUp } from "./use-step-up.client";

type Target = { kind: "device"; row: SessionRowVm } | { kind: "others" };

type SignedInDevicesListProps = {
  sessions: SessionsVm;
  /**
   * Where a full-page fresh sign-in comes back to when the "Confirm it's you" window cannot open;
   * the pending sign-out rides along in `resume`.
   */
  returnTo: string;
};

/**
 * The icon, the text and Sign out on one line; on a phone Sign out drops under the text, in line
 * with it rather than with the icon.
 */
const DEVICE_ROW =
  "grid min-h-16 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:px-6 sm:py-2.5";

function DeviceRow({
  row,
  onSignOut,
  rowRef,
}: {
  row: SessionRowVm;
  onSignOut?: () => void;
  /** Lets the list move focus to a row that has just been revealed. */
  rowRef?: Ref<HTMLLIElement>;
}) {
  return (
    <li
      ref={rowRef}
      tabIndex={rowRef ? -1 : undefined}
      className={cn(DEVICE_ROW, "outline-offset-[-2px]")}
    >
      <DeviceKindIcon kind={row.deviceKind} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-surface">
          {row.deviceLabel}
          {row.isCurrent ? <span className={TAG}>This device</span> : null}
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant">{row.activity}</p>
        <p className="text-xs text-on-surface-variant">
          <ProductText text={row.signedIn} weight="inherit" />
        </p>
      </div>
      {onSignOut ? (
        <Button
          type="button"
          variant="outline"
          className="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:justify-self-end"
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
  const [expanded, setExpanded] = useState(false);
  const firstRevealed = useRef<HTMLLIElement>(null);
  const { shown, hidden } = splitOtherDevices(sessions.others);
  // The action waiting on "Confirm it's you", so the window's answer can run it again.
  const pending = useRef<Target | null>(null);
  const stepUp = useStepUp({
    reason: "sign_out_devices",
    returnTo,
    onConfirmed: () => {
      if (pending.current) void run(pending.current);
    },
  });
  const confirming = stepUp.state.phase !== "idle";

  // Back from a full-page "Confirm it's you": reopen the same dialog (one more click, never an
  // automatic sign-out), then drop `resume` so Back and refresh are ordinary.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once, on arrival
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(RESUME_QUERY)) return;
    const resumed = parseDevicesResume(params.get(RESUME_QUERY), sessions.others);
    if (resumed) setTarget(resumed);
    router.replace(
      withoutResume(`${window.location.pathname}${window.location.search}${window.location.hash}`),
      { scroll: false },
    );
  }, []);

  // The button that revealed the rest is gone, so focus goes to the first row it revealed.
  useEffect(() => {
    if (expanded) firstRevealed.current?.focus();
  }, [expanded]);

  const confirm =
    target?.kind === "device"
      ? buildSignOutDeviceConfirm(target.row)
      : target?.kind === "others"
        ? buildSignOutOthersConfirm(sessions.others.length)
        : null;

  function close() {
    if (busy) return;
    stepUp.cancel();
    pending.current = null;
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
      setBusy(false);
      pending.current = current;
      stepUp.require();
      return;
    }
    pending.current = null;
    setBusy(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setTarget(null);
    setNotice(
      current.kind === "device"
        ? buildSignedOutDeviceMessage(current.row)
        : buildSignedOutOthersMessage(sessions.others.length),
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ListCard>
        {sessions.current ? <DeviceRow row={sessions.current} /> : null}
        {(expanded ? sessions.others : shown).map((row, index) => (
          <DeviceRow
            key={row.id}
            row={row}
            {...(expanded && index === shown.length ? { rowRef: firstRevealed } : {})}
            onSignOut={() => {
              setNotice(null);
              setTarget({ kind: "device", row });
            }}
          />
        ))}
      </ListCard>
      {!expanded && hidden.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          {showMoreDevicesLabel(hidden.length)}
        </Button>
      ) : null}
      {sessions.others.length === 0 ? (
        <p className="text-xs text-on-surface-variant">{NO_OTHER_DEVICES}</p>
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
          title={confirming ? STEP_UP_COPY.title : confirm.title}
          body={
            <>
              <p>
                {confirming ? (
                  target.kind === "device" ? (
                    STEP_UP_COPY.why.sign_out_devices
                  ) : (
                    STEP_UP_COPY.signOutOthers
                  )
                ) : (
                  <ProductText text={confirm.body} />
                )}
              </p>
              {stepUp.state.phase === "waiting" ? (
                <p className="mt-3">{STEP_UP_COPY.waiting}</p>
              ) : null}
              {stepUp.state.phase === "confirm" && stepUp.state.notConfirmed ? (
                <output className="mt-3 block">{STEP_UP_COPY.notConfirmed}</output>
              ) : null}
              {error ? (
                <p role="alert" className="mt-3 text-error">
                  {error}
                </p>
              ) : null}
            </>
          }
          confirmLabel={confirming ? STEP_UP_COPY.continueLabel : confirm.confirmLabel}
          loadingLabel={confirm.loadingLabel}
          loading={busy}
          {...(confirming ? { tone: "warning" as const } : {})}
          onConfirm={() =>
            confirming
              ? stepUp.continue(
                  target.kind === "device"
                    ? signOutDeviceResume(target.row)
                    : SIGN_OUT_OTHERS_RESUME,
                )
              : run(target)
          }
        />
      ) : null}
    </div>
  );
}
