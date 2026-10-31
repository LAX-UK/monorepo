"use client";

import { updateNotificationPreferencesFromValuesAction } from "@/lib/actions/user-notification-preferences";
import {
  ALERT_PRESETS,
  ALERT_PRESET_COPY,
  ALERT_ROWS,
  type AlertChannel,
  type AlertPreset,
  type AlertRow,
  alertCell,
  alertPresetOf,
  withAlertCell,
  withAlertPreset,
} from "@/lib/notifications/alert-matrix";
import {
  type NotificationPreferencesFormValues,
  formValuesToPatch,
  prefsToFormValues,
} from "@/lib/notifications/notification-preferences-registry";
import { notify } from "@/lib/ui/notify";
import { LOCKED_NOTIFICATION_PREFERENCE_REASON } from "@auction/domain";
import type { NotificationPreference } from "@auction/types";
import { Button, Field, PresetCards, Switch, TextInput } from "@auction/ui/lax";
import { Lock } from "lucide-react";
import { useRef, useState, useTransition } from "react";

const CHANNELS: readonly { id: AlertChannel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "app", label: "App" },
];

/**
 * Alerts: the three styles as cards (the chosen one marked, none when the person mixed their
 * own), "Where alerts reach you" as a matrix of Email and App switches, with the alerts that
 * protect a bid or a payment held on and saying why, and quiet hours. Each switch saves at once
 * and goes back if the save fails.
 */
export function AlertsSettings({ initial }: { initial: NotificationPreference }) {
  const [values, setValues] = useState<NotificationPreferencesFormValues>(() =>
    prefsToFormValues(initial),
  );
  const [saved, setSaved] = useState<string>("");
  const [, startTransition] = useTransition();
  const latest = useRef(values);

  const save = (
    next: NotificationPreferencesFormValues,
    previous: NotificationPreferencesFormValues,
  ) => {
    latest.current = next;
    setValues(next);
    setSaved("Saving…");
    startTransition(async () => {
      const result = await updateNotificationPreferencesFromValuesAction(formValuesToPatch(next));
      if (latest.current !== next) return;
      if (result.ok) {
        setSaved("All changes saved");
      } else {
        latest.current = previous;
        setValues(previous);
        setSaved("");
        notify.error("We couldn't save that change", { description: result.error });
      }
    });
  };

  const preset = alertPresetOf(values);

  return (
    <>
      <div>
        <p className="mb-2 text-lax-14 font-semibold text-lax-fg">Alert style</p>
        <PresetCards<AlertPreset | "custom">
          label="Alert style"
          value={preset ?? "custom"}
          onValueChange={(next) => {
            if (next !== "custom") save(withAlertPreset(values, next), values);
          }}
          options={ALERT_PRESETS.map((value) => ({ value, ...ALERT_PRESET_COPY[value] }))}
        />
        {preset ? null : (
          <p className="mt-2 text-lax-13 text-lax-muted">
            You've chosen your own mix below. Pick a style to start again from it.
          </p>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-lax-14 font-semibold text-lax-fg">Where alerts reach you</p>
          <output aria-live="polite" className="text-lax-13 text-lax-muted">
            {saved}
          </output>
        </div>
        <div className="overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
          <table className="w-full border-collapse">
            <caption className="sr-only">Where each alert reaches you</caption>
            <thead>
              <tr className="border-b border-lax-line">
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-lax-13 font-medium text-lax-muted md:px-5"
                >
                  Alert
                </th>
                {CHANNELS.map((channel) => (
                  <th
                    key={channel.id}
                    scope="col"
                    className="w-16 px-1 py-3 text-center text-lax-13 font-medium text-lax-muted md:w-24"
                  >
                    {channel.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-lax-line-subtle">
              {ALERT_ROWS.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-4 py-3 text-left font-normal md:px-5">
                    <span className="block text-lax-14 font-medium text-lax-fg">{row.label}</span>
                    <span className="block text-lax-13 text-lax-muted max-md:hidden">
                      {row.description}
                    </span>
                  </th>
                  {CHANNELS.map((channel) => (
                    <td key={channel.id} className="px-1 py-3 text-center">
                      <AlertSwitch
                        row={row}
                        channel={channel}
                        values={values}
                        onChange={(on) => save(withAlertCell(values, row, channel.id, on), values)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-lax-13 text-lax-fg">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {LOCKED_NOTIFICATION_PREFERENCE_REASON}
        </p>
      </div>
      <QuietHours values={values} onSave={(next) => save(next, values)} />
    </>
  );
}

function AlertSwitch({
  row,
  channel,
  values,
  onChange,
}: {
  row: AlertRow;
  channel: { id: AlertChannel; label: string };
  values: NotificationPreferencesFormValues;
  onChange: (on: boolean) => void;
}) {
  const cell = alertCell(row, channel.id, values);
  if (cell.kind === "none") {
    return (
      <span className="text-lax-13 text-lax-muted">
        <span aria-hidden>–</span>
        <span className="sr-only">{`${row.label} isn't sent by ${channel.label.toLowerCase()}`}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex justify-center">
      <Switch
        aria-label={`${row.label} by ${channel.label.toLowerCase()}`}
        checked={cell.checked}
        onCheckedChange={(checked) => onChange(checked === true)}
        {...(cell.lockedReason ? { lockedReason: cell.lockedReason } : {})}
      />
    </span>
  );
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function QuietHours({
  values,
  onSave,
}: {
  values: NotificationPreferencesFormValues;
  onSave: (next: NotificationPreferencesFormValues) => void;
}) {
  const [start, setStart] = useState(values.quietStart);
  const [end, setEnd] = useState(values.quietEnd);
  const [tried, setTried] = useState(false);
  const bothOrNeither = Boolean(start) === Boolean(end);
  const valid = bothOrNeither && (!start || (TIME.test(start) && TIME.test(end)));
  const changed = start !== values.quietStart || end !== values.quietEnd;
  return (
    <div>
      <p className="text-lax-14 font-semibold text-lax-fg">Quiet hours</p>
      <p className="mt-1 text-lax-13 text-lax-muted">
        App alerts on your devices wait until quiet hours end. Emails still arrive. Times are in
        UTC.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="From" className="w-36" error={tried && !valid ? "Choose both times" : null}>
          <TextInput type="time" value={start} onChange={(event) => setStart(event.target.value)} />
        </Field>
        <Field label="Until" className="w-36">
          <TextInput type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
        </Field>
        {/* Shown once something changed, so there is never a dead button. */}
        {changed ? (
          <Button
            onClick={() => {
              setTried(true);
              if (valid) onSave({ ...values, quietStart: start, quietEnd: end });
            }}
          >
            Save quiet hours
          </Button>
        ) : null}
      </div>
    </div>
  );
}
