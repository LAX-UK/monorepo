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
import {
  QUIET_HOUR_OPTIONS,
  quietHoursZoneLabel,
  quietTimeToLocal,
  quietTimeToUtc,
} from "@/lib/notifications/quiet-hours";
import { notify } from "@/lib/ui/notify";
import { LOCKED_NOTIFICATION_PREFERENCE_REASON } from "@auction/domain";
import type { NotificationPreference } from "@auction/types";
import { Button, Field, NativeSelect, PresetCards, ReasonTooltip, Switch } from "@auction/ui/lax";
import { Lock } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { DevicePushRow } from "./device-push-row";

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
      <DevicePushRow />
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
    const notSent = channel.id === "app" ? "Not sent in the app" : "Not sent by email";
    return (
      <ReasonTooltip reason={notSent}>
        <span
          role="img"
          aria-label={notSent}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users get the tooltip.
          tabIndex={0}
          className="lax-focus inline-flex size-8 items-center justify-center rounded-lax-control text-lax-13 text-lax-muted"
        >
          –
        </span>
      </ReasonTooltip>
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

const NOT_SET = "not-set";

function timeOptions(current: string) {
  const times = new Set(QUIET_HOUR_OPTIONS);
  if (current) times.add(current);
  return [
    { value: NOT_SET, label: "Not set" },
    ...[...times].sort().map((time) => ({ value: time, label: time })),
  ];
}

/**
 * Quiet hours in the person's own time (London), as 24-hour half hours or "Not set", with a way
 * to clear them. The API keeps UTC; the times are converted here, at the edge.
 */
function QuietHours({
  values,
  onSave,
}: {
  values: NotificationPreferencesFormValues;
  onSave: (next: NotificationPreferencesFormValues) => void;
}) {
  const savedStart = quietTimeToLocal(values.quietStart);
  const savedEnd = quietTimeToLocal(values.quietEnd);
  const [start, setStart] = useState(savedStart);
  const [end, setEnd] = useState(savedEnd);
  const [tried, setTried] = useState(false);
  const valid = Boolean(start) === Boolean(end);
  const changed = start !== savedStart || end !== savedEnd;
  const isSet = Boolean(savedStart && savedEnd);
  const hint = isSet
    ? `App alerts on your devices wait from ${savedStart} until ${savedEnd}. Emails still arrive.`
    : "Not set. Choose times to hold app alerts on your devices overnight. Emails still arrive.";
  return (
    <div>
      <p className="text-lax-14 font-semibold text-lax-fg">Quiet hours</p>
      <p className="mt-1 text-lax-13 text-lax-muted">
        {hint} Times are in {quietHoursZoneLabel()}.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="From" className="w-36" error={tried && !valid ? "Choose both times" : null}>
          <NativeSelect
            value={start || NOT_SET}
            onValueChange={(next) => setStart(next === NOT_SET ? "" : next)}
            options={timeOptions(start)}
          />
        </Field>
        <Field label="Until" className="w-36">
          <NativeSelect
            value={end || NOT_SET}
            onValueChange={(next) => setEnd(next === NOT_SET ? "" : next)}
            options={timeOptions(end)}
          />
        </Field>
        {/* Shown once something changed, so there is never a dead button. */}
        {changed ? (
          <Button
            onClick={() => {
              setTried(true);
              if (!valid) return;
              onSave({
                ...values,
                quietStart: quietTimeToUtc(start),
                quietEnd: quietTimeToUtc(end),
              });
            }}
          >
            Save quiet hours
          </Button>
        ) : isSet ? (
          <Button
            variant="ghost"
            onClick={() => {
              setStart("");
              setEnd("");
              onSave({ ...values, quietStart: "", quietEnd: "" });
            }}
          >
            Clear quiet hours
          </Button>
        ) : null}
      </div>
    </div>
  );
}
