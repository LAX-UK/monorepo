"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Check } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import type { KeyboardEvent, ReactNode } from "react";

export type MarketingFilterLinkRowProps = {
  label: string;
  /** Where choosing the option goes; when `checked`, the address with it taken off. */
  href: string;
  count?: number | undefined;
  checked: boolean;
  /**
   * A checkbox may be taken off. A radio is a choice of one, such as a sort order: it is drawn as
   * a radio and marked `aria-current` (it is a link to another address, not a form control).
   */
  kind: "checkbox" | "radio";
  /** A closer row on large screens, for a rail; phones keep the touch size. */
  dense?: boolean;
};

const box =
  "flex size-4 shrink-0 items-center justify-center border border-primary text-on-primary shadow-sm";

/**
 * The row's content. It reads whether the navigation this link started is still under way, and
 * dims and marks itself busy until the results arrive, so a tap is answered at once.
 */
function RowBody({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      data-pending={pending ? "true" : undefined}
      aria-busy={pending ? true : undefined}
      className={cn(
        "flex w-full items-center gap-3 transition-opacity motion-reduce:transition-none",
        pending && "opacity-60",
      )}
    >
      {children}
    </span>
  );
}

/** Space chooses a checkbox-role link, as it does a real checkbox, and does not scroll the page. */
function chooseWithSpace(event: KeyboardEvent<HTMLAnchorElement>) {
  if (event.key !== " ") return;
  event.preventDefault();
  event.currentTarget.click();
}

/**
 * A filter option that is a real link to the filtered address, so filtering works without
 * JavaScript and stays crawlable, drawn as a checkbox or radio row. A checkbox carries the
 * checkbox role with `aria-checked`, answers Space as well as Enter, and its name includes the
 * count ("Brands, 4"). A choice of one is a plain link marked `aria-current`, so Tab and Enter
 * work as on any link list. An option with no works has no address and is dimmed, unless it is
 * applied, so it can still be taken off.
 */
export function MarketingFilterLinkRow({
  label,
  href,
  count,
  checked,
  kind,
  dense = false,
}: MarketingFilterLinkRowProps) {
  const unavailable = !checked && count === 0;
  const rowClass = cn(
    "flex min-h-11 w-full items-center gap-3 rounded-sm font-body text-sm font-normal text-on-surface",
    dense && "lg:min-h-9",
    unavailable ? "cursor-not-allowed text-on-surface-variant opacity-60" : "cursor-pointer",
    FOCUS_RING,
  );
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          box,
          kind === "radio" ? "rounded-full" : "rounded-sm",
          checked && kind === "checkbox" ? "bg-primary" : "bg-transparent",
        )}
      >
        {checked && kind === "checkbox" ? <Check className="size-3.5" /> : null}
        {checked && kind === "radio" ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="flex flex-1 items-center justify-between gap-2">
        <span>{label}</span>
        {count !== undefined ? (
          <>
            <span
              aria-hidden="true"
              className="font-body text-xs tabular-nums text-on-surface-variant"
            >
              {count}
            </span>
            <span className="sr-only">, {count}</span>
          </>
        ) : null}
      </span>
    </>
  );

  const isCheckbox = kind === "checkbox";
  // A checkbox row carries the checkbox role; a choice of one is a plain link (see above).
  const role = isCheckbox ? "checkbox" : undefined;

  if (unavailable) {
    return (
      <span
        role={role}
        aria-checked={isCheckbox ? false : undefined}
        aria-disabled="true"
        tabIndex={isCheckbox ? -1 : undefined}
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
      role={role}
      aria-checked={isCheckbox ? checked : undefined}
      aria-current={!isCheckbox && checked ? "true" : undefined}
      onKeyDown={isCheckbox ? chooseWithSpace : undefined}
      className={rowClass}
    >
      <RowBody>{content}</RowBody>
    </Link>
  );
}
