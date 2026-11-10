"use client";

import type { ReactNode, Ref } from "react";
import { cn } from "../lib/utils.js";
import { RADIO_ROW_CLASS } from "./zone-list.js";

export type ZoneModeOptionProps = {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  /** The line under the title. */
  detail?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
};

/** One of the two ways to choose: follow the device, or always use a city. */
export function ZoneModeOption({
  name,
  checked,
  onSelect,
  title,
  detail,
  inputRef,
}: ZoneModeOptionProps) {
  return (
    <label className={cn(RADIO_ROW_CLASS, "py-2", checked && "bg-lax-selected")}>
      <input
        ref={inputRef}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="size-4 shrink-0 accent-[var(--lax-ink)]"
      />
      <span className="grid min-w-0 flex-1">
        <span className="font-medium">{title}</span>
        {detail ? <span className="text-lax-13 leading-5 text-lax-muted">{detail}</span> : null}
      </span>
    </label>
  );
}
