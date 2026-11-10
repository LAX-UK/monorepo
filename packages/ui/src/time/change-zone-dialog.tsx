"use client";

import { cityName, deviceTimeZone, gmtOffsetLabel } from "@auction/datetime";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../lax/button.js";
import { Dialog, DialogClose } from "../lax/dialog.js";
import { type SavedZone, canSaveZoneChoice, initialZoneChoice } from "./zone-choice.js";
import { ZoneList } from "./zone-list.js";
import { ZoneModeOption } from "./zone-mode-option.js";
import { useZonePreference } from "./zone-preference.js";

export type ChangeZoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The zone in use now, and where it came from: it decides what opens selected. */
  current: SavedZone;
  officialZone: string;
  /** The moment the labels are written for. */
  at: Date;
  /** Where focus goes on closing: the panel that opened the dialog is gone by then. */
  returnFocusTo?: () => HTMLElement | null;
};

/** "Sydney (GMT+11)": the device's city with its offset now. */
function deviceLabel(zone: string, at: Date): string {
  return `${cityName(zone)} (${gmtOffsetLabel(at, zone)})`;
}

/**
 * The one place a visitor changes their zone from a page: a sheet on a phone, a dialog from 768px
 * (the kit dialog does both). Two choices, Automatic (the device's zone) or Always use one city.
 * One field, so a failed save is said inline.
 */
export function ChangeZoneDialog({
  open,
  onOpenChange,
  current,
  officialZone,
  at,
  returnFocusTo,
}: ChangeZoneDialogProps) {
  const port = useZonePreference();
  const modeName = useId();
  const [choice, setChoice] = useState(() => initialZoneChoice(current));
  const [wasOpen, setWasOpen] = useState(open);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // The device's reading, taken when the sheet opens (it is a browser-only value).
  const device = useMemo(() => (open ? deviceTimeZone() : null), [open]);
  const focusRef = useRef<HTMLInputElement>(null);

  if (open !== wasOpen) {
    // Each opening starts from what is in use now, before the sheet draws.
    setWasOpen(open);
    if (open) {
      setChoice(initialZoneChoice(current));
      setFailed(false);
    }
  }

  const fixedZone = choice.mode === "fixed" ? choice.zone : null;
  const startsAutomatic = initialZoneChoice(current).mode === "automatic";
  const canSave = canSaveZoneChoice(choice, current);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setFailed(false);
    try {
      if (choice.mode === "automatic") await port.followDevice();
      else if (choice.zone) await port.save(choice.zone);
      const shown = choice.mode === "automatic" ? device : choice.zone;
      toast.success(
        shown
          ? `Saved. Times now show ${cityName(shown)} time.`
          : "Saved. Times now follow this device.",
      );
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Time zone"
      initialFocusRef={focusRef}
      {...(returnFocusTo ? { returnFocusFallback: returnFocusTo } : {})}
      description={`Sale times always show ${cityName(officialZone)} time first. Choose the city for the time under it.`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary" size="lg">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="primary" size="lg" onClick={save} disabled={!canSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <fieldset className="m-0 grid min-w-0 gap-0.5 border-0 p-0">
          <legend className="sr-only">How to choose the time zone</legend>
          <ZoneModeOption
            name={modeName}
            checked={choice.mode === "automatic"}
            onSelect={() => setChoice({ mode: "automatic" })}
            title="Automatic"
            detail={
              device
                ? `Use this device’s time zone: ${deviceLabel(device, at)}`
                : "Use this device’s time zone"
            }
            {...(startsAutomatic ? { inputRef: focusRef } : {})}
          />
          <ZoneModeOption
            name={modeName}
            checked={choice.mode === "fixed"}
            onSelect={() => setChoice({ mode: "fixed", zone: fixedZone })}
            title="Always use"
          />
        </fieldset>
        <ZoneList
          value={fixedZone}
          onChange={(zone) => setChoice({ mode: "fixed", zone })}
          at={at}
          pinned={current.source === "device" ? null : current.zone}
          {...(startsAutomatic ? {} : { checkedRef: focusRef })}
        />
        {failed ? (
          <p role="alert" className="m-0 text-lax-13 leading-5 text-lax-danger">
            We couldn’t save your time zone. Try again.
          </p>
        ) : null}
        <p className="m-0 text-lax-13 leading-5 text-lax-muted">{port.savedNote}</p>
      </div>
    </Dialog>
  );
}
