"use client";

import type { BidEntry, BidEntryControl, BidEntryDestination, BidMode } from "@auction/domain";
import { Button, ButtonLink } from "@auction/ui/lax";
import { Info } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

export type BidEntryHrefs = Readonly<Record<BidEntryDestination, string>>;

type Emphasis = "primary" | "secondary" | "text";

const VARIANT = { primary: "primary", secondary: "secondary", text: "ghost" } as const;
const SIZE = { primary: "lg", secondary: "lg", text: "sm" } as const;
const WIDTH = { primary: "w-full", secondary: "w-full", text: "" } as const;

function Control({
  control,
  emphasis,
  hrefs,
  onOpen,
  disabledReason,
  describedBy,
}: {
  control: BidEntryControl;
  emphasis: Emphasis;
  hrefs: BidEntryHrefs;
  onOpen: (start: BidMode) => void;
  disabledReason?: string | null;
  describedBy?: string | undefined;
}) {
  const common = { variant: VARIANT[emphasis], size: SIZE[emphasis], className: WIDTH[emphasis] };
  if (control.kind === "go") {
    return (
      <ButtonLink href={hrefs[control.to]} Link={Link} {...common}>
        {control.label}
      </ButtonLink>
    );
  }
  return (
    <Button
      {...common}
      onClick={() => onOpen(control.start)}
      {...(disabledReason ? { disabledReason, "aria-describedby": describedBy } : {})}
    >
      {control.label}
    </Button>
  );
}

/**
 * What to press on a lot you can take part in: the main button, a quieter one for someone who is
 * leading, a text link for the other way to bid, and a line of help. A button that can't be
 * pressed says why in words beside it, not only in a tooltip.
 */
export function BidEntryControls({
  entry,
  hrefs,
  onOpen,
}: {
  entry: BidEntry;
  hrefs: BidEntryHrefs;
  onOpen: (start: BidMode) => void;
}) {
  const reasonId = useId();
  const { primary, secondary, alt, help } = entry;
  if (!primary && !secondary && !alt && !help) return null;
  return (
    <div className="grid gap-3">
      {primary ? (
        <>
          <Control
            control={primary.control}
            emphasis="primary"
            hrefs={hrefs}
            onOpen={onOpen}
            disabledReason={primary.disabledReason}
            describedBy={reasonId}
          />
          {primary.disabledReason ? (
            <p
              id={reasonId}
              className="m-0 flex items-start gap-1.5 text-lax-13 leading-5 text-lax-muted"
            >
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {primary.disabledReason}
            </p>
          ) : null}
        </>
      ) : null}
      {secondary ? (
        <Control control={secondary} emphasis="secondary" hrefs={hrefs} onOpen={onOpen} />
      ) : null}
      {alt ? (
        <div className="flex justify-center">
          <Control control={alt} emphasis="text" hrefs={hrefs} onOpen={onOpen} />
        </div>
      ) : null}
      {help ? (
        <p className="m-0 text-lax-13 leading-5 text-lax-muted">
          {help.text}
          {help.withBiddingGuide ? (
            <>
              {" "}
              <Link href="/faq" className="text-lax-fg underline underline-offset-2">
                How bidding works
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
