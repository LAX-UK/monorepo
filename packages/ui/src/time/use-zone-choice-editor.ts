"use client";

import { cityName, deviceTimeZone } from "@auction/datetime";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type SavedZone,
  type ZoneChoiceState,
  canSaveZoneChoice,
  initialZoneChoice,
} from "./zone-choice.js";
import { useZonePreference } from "./zone-preference.js";

export type ZoneChoiceEditor = {
  choice: ZoneChoiceState;
  setChoice: (choice: ZoneChoiceState) => void;
  /** The device's zone, read when editing starts (it is a browser-only value). */
  device: string | null;
  startsAutomatic: boolean;
  canSave: boolean;
  saving: boolean;
  failed: boolean;
  /** Saves the choice, says so in a toast and calls `onSaved`; a failure is kept for `failed`. */
  save: () => Promise<void>;
};

/**
 * The state behind changing the time zone, shared by the sheet on Bid and the inline row in LAX
 * Account: what is selected, whether it can be saved, and the save itself. Each time editing
 * starts, the choice returns to what is in use now. One field, so a failed save is said inline.
 */
export function useZoneChoiceEditor({
  current,
  active,
  onSaved,
}: {
  current: SavedZone;
  /** Whether the editor is open; opening again starts over from `current`. */
  active: boolean;
  onSaved: () => void;
}): ZoneChoiceEditor {
  const port = useZonePreference();
  const [choice, setChoice] = useState(() => initialZoneChoice(current));
  const [wasActive, setWasActive] = useState(active);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const device = useMemo(() => (active ? deviceTimeZone() : null), [active]);

  if (active !== wasActive) {
    // Each opening starts from what is in use now, before anything draws.
    setWasActive(active);
    if (active) {
      setChoice(initialZoneChoice(current));
      setFailed(false);
    }
  }

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
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return {
    choice,
    setChoice,
    device,
    startsAutomatic: initialZoneChoice(current).mode === "automatic",
    canSave,
    saving,
    failed,
    save,
  };
}
