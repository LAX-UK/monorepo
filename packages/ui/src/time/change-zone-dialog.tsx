"use client";

import { cityName } from "@auction/datetime";
import { useEffect, useState } from "react";
import { Button } from "../lax/button.js";
import { Dialog, DialogClose } from "../lax/dialog.js";
import { ZoneList } from "./zone-list.js";
import { useZonePreference } from "./zone-preference.js";

export type ChangeZoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The zone chosen now, preselected. */
  current: string | null;
  officialZone: string;
  /** The moment the labels are written for. */
  at: Date;
  /** Where focus goes on closing: the panel that opened the dialog is gone by then. */
  returnFocusTo?: () => HTMLElement | null;
};

/**
 * The one place a visitor changes their zone from a page: a sheet on a phone, a dialog from 768px
 * (the kit dialog does both). One field, so a failed save is said inline.
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
  const [zone, setZone] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setZone(current);
    setFailed(false);
  }, [open, current]);

  const save = async () => {
    if (!zone) return;
    setSaving(true);
    setFailed(false);
    try {
      await port.save(zone);
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
      {...(returnFocusTo ? { returnFocusFallback: returnFocusTo } : {})}
      description={`Sale times always show ${cityName(officialZone)} time first. Choose the city for the time under it.`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary" size="lg">
              Cancel
            </Button>
          </DialogClose>
          <Button size="lg" onClick={save} disabled={!zone} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <ZoneList value={zone} onChange={setZone} at={at} />
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
