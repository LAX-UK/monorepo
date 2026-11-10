"use client";

import { type ZoneChoice, listZoneChoices, rankZoneChoices } from "@auction/datetime";
import { Search } from "lucide-react";
import { type Ref, useId, useMemo, useState } from "react";
import { TextInput } from "../lax/input.js";
import { cn } from "../lib/utils.js";

/** More than this is a list to scroll, not to choose from; typing narrows it. */
const VISIBLE_CHOICES = 40;

export type ZoneListProps = {
  /** The zone chosen now. */
  value: string | null;
  onChange: (zone: string) => void;
  /** The instant labels are written for, so the short names (GMT, CET) are right for that date. */
  at: Date;
  /** The zone saved now: always in the list, first when nothing is typed. */
  pinned?: string | null;
  /** Reaches the checked option, so a dialog can put focus there on opening. */
  checkedRef?: Ref<HTMLInputElement>;
};

/**
 * A searchable list of cities. The saved zone leads, then the pinned places, until something is
 * typed.
 */
export function ZoneList({ value, onChange, at, pinned = null, checkedRef }: ZoneListProps) {
  const [query, setQuery] = useState("");
  const name = useId();
  const choices = useMemo(() => listZoneChoices(at), [at]);
  const hasQuery = query.trim() !== "";
  const matches = useMemo(
    () =>
      leadWith(rankZoneChoices(choices, query), hasQuery ? null : pinned).slice(0, VISIBLE_CHOICES),
    [choices, query, hasQuery, pinned],
  );
  return (
    <div className="grid gap-3">
      <TextInput
        type="search"
        size="lg"
        aria-label="Search cities"
        placeholder="Search cities, e.g. New York"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leading={<Search aria-hidden />}
      />
      {matches.length === 0 ? (
        <output className="m-0 block text-lax-13 leading-5 text-lax-muted">
          No city matches “{query.trim()}”. Try a nearby large city.
        </output>
      ) : (
        <fieldset className="m-0 grid max-h-64 min-w-0 gap-0.5 overflow-y-auto border-0 p-0">
          <legend className="sr-only">{hasQuery ? "Matching cities" : "Cities"}</legend>
          {matches.map((choice) => (
            <ZoneOption
              key={choice.zone}
              choice={choice}
              name={name}
              checked={choice.zone === value}
              onSelect={onChange}
              {...(choice.zone === value && checkedRef ? { inputRef: checkedRef } : {})}
            />
          ))}
        </fieldset>
      )}
    </div>
  );
}

/** One radio row: shared by the cities and the two ways of choosing. */
export const RADIO_ROW_CLASS = cn(
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lax-control px-3 font-lax text-lax-14 text-lax-fg",
  "hover:bg-lax-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-lax-focus",
);

function ZoneOption({
  choice,
  name,
  checked,
  onSelect,
  inputRef,
}: {
  choice: ZoneChoice;
  name: string;
  checked: boolean;
  onSelect: (zone: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className={cn(RADIO_ROW_CLASS, checked && "bg-lax-selected font-medium")}>
      <input
        ref={inputRef}
        type="radio"
        name={name}
        value={choice.zone}
        checked={checked}
        onChange={() => onSelect(choice.zone)}
        className="size-4 shrink-0 accent-[var(--lax-ink)]"
      />
      <span className="min-w-0 flex-1 truncate">{choice.label}</span>
    </label>
  );
}

/** The same list with one zone moved to the front; unchanged when it is not in the list. */
function leadWith(choices: ZoneChoice[], zone: string | null): ZoneChoice[] {
  const lead = zone ? choices.find((choice) => choice.zone === zone) : undefined;
  return lead ? [lead, ...choices.filter((choice) => choice !== lead)] : choices;
}
