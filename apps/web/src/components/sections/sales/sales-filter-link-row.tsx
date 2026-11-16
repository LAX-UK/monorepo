"use client";

import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui/lib/utils";
import { Check, CircleIcon } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent } from "react";

/**
 * The sales rail's option row: a real link to the filtered address, so every value is in the
 * server HTML and reachable without JavaScript. It is drawn exactly as the rail's checkbox and
 * radio rows were (the `@auction/ui` Checkbox, RadioGroupItem and Label classes), with no pending
 * or transition state of its own.
 */
export type SalesFilterLinkRowProps = {
  label: string;
  /** Where choosing the option goes; when `checked`, the address with it taken off. */
  href: string;
  /** Sales the option would give; absent when counts could not be made. */
  count?: number | undefined;
  checked: boolean;
  /** A checkbox can be taken off; a radio is a choice of one, marked `aria-current`. */
  kind: "checkbox" | "radio";
  /** Runs when the link is followed, e.g. to close the sheet the row is in. */
  onClick?: () => void;
};

// The Checkbox box from `@auction/ui/components/checkbox`, as a drawing.
const CHECKBOX_BOX =
  "flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary text-on-primary shadow";
// The RadioGroupItem circle from `@auction/ui/components/radio-group`, as a drawing.
const RADIO_BOX =
  "flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border border-input text-primary shadow-xs dark:bg-input/30";
// The Label from `@auction/ui/components/label`, with the rail row's own classes on top.
const LABEL =
  "flex min-h-11 flex-1 items-center justify-between gap-2 py-2 font-body text-sm font-normal text-on-surface lg:min-h-9";

/** Space chooses a checkbox-role link, as it does a real checkbox, and does not scroll the page. */
function chooseWithSpace(event: KeyboardEvent<HTMLAnchorElement>) {
  if (event.key !== " ") return;
  event.preventDefault();
  event.currentTarget.click();
}

export function SalesFilterLinkRow({
  label,
  href,
  count,
  checked,
  kind,
  onClick,
}: SalesFilterLinkRowProps) {
  const isCheckbox = kind === "checkbox";
  const unavailable = !checked && count === 0;
  // The count is part of the name ("Paintings, 12"); one string, so no stray space before the comma.
  const name = count !== undefined ? `${label}, ${count}` : undefined;
  const rowClass = cn("flex min-h-11 items-center gap-3 rounded-sm lg:min-h-9", FOCUS_RING);

  const content = (
    <>
      {isCheckbox ? (
        <span
          aria-hidden="true"
          className={cn(CHECKBOX_BOX, checked && "bg-primary", unavailable && "opacity-50")}
        >
          {checked ? <Check className="size-3.5" /> : null}
        </span>
      ) : (
        <span aria-hidden="true" className={RADIO_BOX}>
          {checked ? (
            <span className="relative flex items-center justify-center">
              <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
            </span>
          ) : null}
        </span>
      )}
      <span
        className={cn(
          LABEL,
          // On main the Label's `peer-disabled:opacity-70` won over `opacity-60`: 70 is what showed.
          unavailable ? "cursor-not-allowed text-on-surface-variant opacity-70" : "cursor-pointer",
        )}
      >
        <span>{label}</span>
        {count !== undefined ? (
          <span
            aria-hidden="true"
            className="font-body text-xs tabular-nums text-on-surface-variant"
          >
            {count}
          </span>
        ) : null}
      </span>
    </>
  );

  if (unavailable) {
    return (
      <span
        role={isCheckbox ? "checkbox" : undefined}
        aria-checked={isCheckbox ? false : undefined}
        aria-disabled="true"
        aria-label={name}
        className={rowClass}
      >
        {content}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      role={isCheckbox ? "checkbox" : undefined}
      aria-checked={isCheckbox ? checked : undefined}
      aria-current={!isCheckbox && checked ? "true" : undefined}
      aria-label={name}
      onKeyDown={isCheckbox ? chooseWithSpace : undefined}
      {...(onClick ? { onClick } : {})}
      className={rowClass}
    >
      {content}
    </Link>
  );
}
