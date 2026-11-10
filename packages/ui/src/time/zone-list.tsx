"use client";

import { type ZoneChoice, listZoneChoices, rankZoneChoices } from "@auction/datetime";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
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
};

/** A searchable list of cities. The pinned places lead until something is typed. */
export function ZoneList({ value, onChange, at }: ZoneListProps) {
  const [query, setQuery] = useState("");
  const name = useId();
  const choices = useMemo(() => listZoneChoices(at), [at]);
  const matches = useMemo(
    () => rankZoneChoices(choices, query).slice(0, VISIBLE_CHOICES),
    [choices, query],
  );
  const hasQuery = query.trim() !== "";
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
            />
          ))}
        </fieldset>
      )}
    </div>
  );
}

function ZoneOption({
  choice,
  name,
  checked,
  onSelect,
}: {
  choice: ZoneChoice;
  name: string;
  checked: boolean;
  onSelect: (zone: string) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lax-control px-3 font-lax text-lax-14 text-lax-fg",
        "hover:bg-lax-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-lax-focus",
        checked && "bg-lax-selected font-medium",
      )}
    >
      <input
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
