"use client";

import { cityName, gmtOffsetLabel } from "@auction/datetime";
import { type Ref, useId } from "react";
import type { SavedZone, ZoneChoiceState } from "./zone-choice.js";
import { ZoneList } from "./zone-list.js";
import { ZoneModeOption } from "./zone-mode-option.js";

export type ZoneChoiceFieldsProps = {
  choice: ZoneChoiceState;
  onChoiceChange: (choice: ZoneChoiceState) => void;
  /** The zone in use now, which leads the list when it is a chosen city. */
  current: SavedZone;
  /** The device's zone, or null before it is read. */
  device: string | null;
  startsAutomatic: boolean;
  /** The moment the labels are written for. */
  at: Date;
  /** Reaches the option that should take focus on opening. */
  focusRef?: Ref<HTMLInputElement>;
};

/** "Sydney (GMT+11)": the device's city with its offset now. */
function deviceLabel(zone: string, at: Date): string {
  return `${cityName(zone)} (${gmtOffsetLabel(at, zone)})`;
}

/**
 * The two ways to choose a zone and the city list under them: Automatic (the device's zone) or
 * Always use one city. The body of both the Bid dialog and Account's inline editor.
 */
export function ZoneChoiceFields({
  choice,
  onChoiceChange,
  current,
  device,
  startsAutomatic,
  at,
  focusRef,
}: ZoneChoiceFieldsProps) {
  const modeName = useId();
  const fixedZone = choice.mode === "fixed" ? choice.zone : null;
  return (
    <>
      <fieldset className="m-0 grid min-w-0 gap-0.5 border-0 p-0">
        <legend className="sr-only">How to choose the time zone</legend>
        <ZoneModeOption
          name={modeName}
          checked={choice.mode === "automatic"}
          onSelect={() => onChoiceChange({ mode: "automatic" })}
          title="Automatic"
          detail={
            device
              ? `Use this device’s time zone: ${deviceLabel(device, at)}`
              : "Use this device’s time zone"
          }
          {...(focusRef && startsAutomatic ? { inputRef: focusRef } : {})}
        />
        <ZoneModeOption
          name={modeName}
          checked={choice.mode === "fixed"}
          onSelect={() => onChoiceChange({ mode: "fixed", zone: fixedZone })}
          title="Always use"
        />
      </fieldset>
      <ZoneList
        value={fixedZone}
        onChange={(zone) => onChoiceChange({ mode: "fixed", zone })}
        at={at}
        pinned={current.source === "device" ? null : current.zone}
        {...(focusRef && !startsAutomatic ? { checkedRef: focusRef } : {})}
      />
    </>
  );
}
