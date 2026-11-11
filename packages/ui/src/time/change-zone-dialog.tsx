"use client";

import { cityName } from "@auction/datetime";
import { useRef } from "react";
import { Button } from "../lax/button.js";
import { Dialog, DialogClose } from "../lax/dialog.js";
import { useZoneChoiceEditor } from "./use-zone-choice-editor.js";
import { ZoneChoiceFields } from "./zone-choice-fields.js";
import type { SavedZone } from "./zone-choice.js";
import { useZonePreference } from "./zone-preference.js";

export type ChangeZoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The zone in use now, and where it came from: it decides what opens selected. */
  current: SavedZone;
  /** The sale's own zone, said in the description. Leave out where nothing is quoted in one. */
  officialZone?: string;
  /** The moment the labels are written for. */
  at: Date;
  /** Where focus goes on closing: the panel that opened the dialog is gone by then. */
  returnFocusTo?: () => HTMLElement | null;
};

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
  const editor = useZoneChoiceEditor({
    current,
    active: open,
    onSaved: () => onOpenChange(false),
  });
  const focusRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Time zone"
      initialFocusRef={focusRef}
      {...(returnFocusTo ? { returnFocusFallback: returnFocusTo } : {})}
      description={
        officialZone
          ? `Sale times always show ${cityName(officialZone)} time first. Choose the city for the time under it.`
          : "Choose the city for the times we show you."
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary" size="lg">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="lg"
            onClick={editor.save}
            disabled={!editor.canSave}
            loading={editor.saving}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <ZoneChoiceFields
          choice={editor.choice}
          onChoiceChange={editor.setChoice}
          current={current}
          device={editor.device}
          startsAutomatic={editor.startsAutomatic}
          at={at}
          focusRef={focusRef}
        />
        {editor.failed ? (
          <p role="alert" className="m-0 text-lax-13 leading-5 text-lax-danger">
            We couldn’t save your time zone. Try again.
          </p>
        ) : null}
        {port.savedNote ? (
          <p className="m-0 text-lax-13 leading-5 text-lax-muted">{port.savedNote}</p>
        ) : null}
      </div>
    </Dialog>
  );
}
