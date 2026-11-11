"use client";

import { Button, LoadingButton } from "@/components/account-button";
import { CARD } from "@/components/account-ui";
import {
  reportDeviceZoneAction,
  saveTimeZoneAction,
} from "@/server/application/account-identity-actions.server";
import type { TimeZoneActionResult } from "@/server/domain/account-action-result";
import { buildReauthHref } from "@/server/domain/account-reauth";
import {
  type TimeZonePreferenceVm,
  shouldReportDeviceZone,
  timeZoneSummary,
  toTimeZonePreferenceVm,
} from "@/server/domain/account-time-zone.vm";
import { deviceTimeZone } from "@auction/datetime";
import { Skeleton } from "@auction/ui";
import {
  type SavedZone,
  ZoneChoiceFields,
  type ZonePreferencePort,
  ZonePreferenceProvider,
  useZoneChoiceEditor,
} from "@auction/ui/time";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type TimeZoneSectionProps = {
  /** What the issuer holds; null when it could not be reached. */
  initial: { mode: "automatic" | "fixed"; zone: string | null } | null;
  /** The moment zone labels are written for, fixed by the server so hydration agrees. */
  at: string;
  /** Where to come back to if the person has to sign in again. */
  returnTo: string;
};

const noSubscription = () => () => {};
/** False while the page hydrates, true after: the device's zone is only known in the browser. */
function useBrowserReady(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/**
 * Personal details → "Time zone for emails and dates". One row that says which zone is in use
 * and where it came from; "Change" opens the choice in place: Automatic follows this device, or
 * Always use one city. Saving is confirmed by the toast. A fixed city on a device somewhere else
 * gets a one-line note, never a prompt.
 */
export function TimeZoneSection({ initial, at, returnTo }: TimeZoneSectionProps) {
  const router = useRouter();
  const ready = useBrowserReady();
  const [preference, setPreference] = useState<TimeZonePreferenceVm | null>(
    initial ? toTimeZonePreferenceVm(initial) : null,
  );
  const [editing, setEditing] = useState(false);
  const reported = useRef<string | null>(null);
  const when = useMemo(() => new Date(at), [at]);
  const device = ready ? deviceTimeZone() : null;

  // Visiting while following the device keeps the stored zone current (emails use it).
  useEffect(() => {
    if (!preference || !shouldReportDeviceZone(preference, device)) return;
    if (reported.current === device) return;
    reported.current = device;
    void reportDeviceZoneAction(device).then((result) => {
      if (result.status === "ok") setPreference(toTimeZonePreferenceVm(result));
    });
  }, [preference, device]);

  const port = useMemo<ZonePreferencePort>(() => {
    function accept(result: TimeZoneActionResult): void {
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        throw new Error("time_zone_sign_in_required");
      }
      if (result.status === "error") throw new Error("time_zone_not_saved");
      setPreference(toTimeZonePreferenceVm(result));
      router.refresh();
    }
    return {
      save: async (zone) => accept(await saveTimeZoneAction({ mode: "fixed", zone })),
      followDevice: async () =>
        accept(await saveTimeZoneAction({ mode: "automatic", zone: deviceTimeZone() })),
    };
  }, [returnTo, router]);

  if (!preference) {
    return (
      <p role="alert" className="text-sm text-error">
        We couldn't load your time zone just now. Please refresh the page to try again.
      </p>
    );
  }

  const current: SavedZone =
    preference.mode === "fixed"
      ? { zone: preference.zone, source: "account" }
      : { zone: preference.zone ?? device ?? "", source: "device" };

  return (
    <div className={`${CARD} px-4 py-4 sm:px-6`}>
      {editing ? (
        <ZonePreferenceProvider port={port}>
          <ZoneEditor current={current} at={when} onDone={() => setEditing(false)} />
        </ZonePreferenceProvider>
      ) : (
        <ZoneRow
          preference={preference}
          device={device}
          ready={ready}
          at={when}
          onChange={() => setEditing(true)}
        />
      )}
    </div>
  );
}

const ROW_LABEL = "Time zone for emails and dates";

function ZoneRow({
  preference,
  device,
  ready,
  at,
  onChange,
}: {
  preference: TimeZonePreferenceVm;
  device: string | null;
  ready: boolean;
  at: Date;
  onChange: () => void;
}) {
  const summary = timeZoneSummary(preference, device, at);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-on-surface-variant">{ROW_LABEL}</p>
        {ready ? (
          <>
            <p className="mt-0.5 text-base font-medium text-on-surface">{summary.value}</p>
            {summary.detail ? (
              <p className="mt-1 text-sm text-on-surface-variant">{summary.detail}</p>
            ) : null}
          </>
        ) : (
          <div aria-busy="true" className="mt-1 grid gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        )}
      </div>
      <Button variant="underline" onClick={onChange} aria-label={`Change: ${ROW_LABEL}`}>
        Change
      </Button>
    </div>
  );
}

function ZoneEditor({
  current,
  at,
  onDone,
}: {
  current: SavedZone;
  at: Date;
  onDone: () => void;
}) {
  const editor = useZoneChoiceEditor({ current, active: true, onSaved: onDone });
  return (
    <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0">
      <legend className="mb-3 text-sm text-on-surface-variant">{ROW_LABEL}</legend>
      <ZoneChoiceFields
        choice={editor.choice}
        onChoiceChange={editor.setChoice}
        current={current}
        device={editor.device}
        startsAutomatic={editor.startsAutomatic}
        at={at}
      />
      {editor.failed ? (
        <p role="alert" className="text-sm text-error">
          We couldn’t save your time zone. Try again.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <LoadingButton
          variant="cta"
          loading={editor.saving}
          loadingLabel="Saving…"
          disabled={!editor.canSave}
          onClick={editor.save}
        >
          Save
        </LoadingButton>
        <Button variant="outline" onClick={onDone} disabled={editor.saving}>
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}
