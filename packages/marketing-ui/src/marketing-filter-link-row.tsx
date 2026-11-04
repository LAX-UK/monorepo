import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Check } from "lucide-react";
import Link from "next/link";

export type MarketingFilterLinkRowProps = {
  label: string;
  /** Where choosing the option goes; when `checked`, the address with it taken off. */
  href: string;
  count?: number | undefined;
  checked: boolean;
  /** A checkbox may be taken off; a radio is a choice of one. */
  kind: "checkbox" | "radio";
  /** A closer row on large screens, for a rail; phones keep the touch size. */
  dense?: boolean;
};

const box =
  "flex size-4 shrink-0 items-center justify-center border border-primary text-on-primary shadow-sm";

/**
 * A filter option that is a real link to the filtered address, so filtering works without
 * JavaScript and stays crawlable, drawn as a checkbox or radio row. It carries the checkbox or
 * radio role with `aria-checked`, and its name includes the count ("Brands, 4"). An option with no
 * works has no address and is dimmed, unless it is applied, so it can still be taken off.
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

  if (unavailable) {
    return (
      <span role={kind} aria-checked={false} aria-disabled="true" className={rowClass}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} role={kind} aria-checked={checked} className={rowClass}>
      {content}
    </Link>
  );
}
