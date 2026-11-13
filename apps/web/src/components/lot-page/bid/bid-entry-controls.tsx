"use client";

import { preloadBidDialog } from "@/components/lot-page/bid/bid-dialog.lazy";
import {
  BUYER_PREMIUM_CONDITIONS_HREF,
  CONDITIONS_OF_SALE_LABEL,
} from "@/lib/lot/buyer-premium-copy";
import type { BidEntry, BidEntryControl, BidEntryDestination, BidMode } from "@auction/domain";
import { Button } from "@auction/ui/lax/button";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Info } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

export type BidEntryHrefs = Readonly<Record<BidEntryDestination, string>>;

/** `bar` and `barSecondary` are the phone bar's button: the same control, sized to its column. */
type Emphasis = "primary" | "secondary" | "text" | "bar" | "barSecondary";

const VARIANT = {
  primary: "primary",
  secondary: "secondary",
  text: "ghost",
  bar: "primary",
  barSecondary: "secondary",
} as const;
const SIZE = { primary: "lg", secondary: "lg", text: "sm", bar: "lg", barSecondary: "lg" } as const;
const BAR_WIDTH = "w-auto min-w-[8.25rem] shrink-0";
const WIDTH = {
  primary: "w-full",
  secondary: "w-full",
  text: "",
  bar: BAR_WIDTH,
  barSecondary: BAR_WIDTH,
} as const;

/** Starts fetching the bid dialog; a failure is dealt with when it is actually opened. */
function warmBidDialog() {
  preloadBidDialog().catch(() => {});
}

export function BidControlButton({
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
      // Fetch the dialog as soon as the control is approached, so it opens at once when pressed.
      onPointerEnter={warmBidDialog}
      onFocus={warmBidDialog}
      onPointerDown={warmBidDialog}
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
          <BidControlButton
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
        <BidControlButton control={secondary} emphasis="secondary" hrefs={hrefs} onOpen={onOpen} />
      ) : null}
      {alt ? (
        <div className="flex justify-center">
          <BidControlButton control={alt} emphasis="text" hrefs={hrefs} onOpen={onOpen} />
        </div>
      ) : null}
      {help ? (
        <p className="m-0 text-lax-13 leading-5 text-lax-muted">
          {help.text}
          {help.withConditions ? (
            <>
              {" "}
              <Link
                href={BUYER_PREMIUM_CONDITIONS_HREF}
                className="whitespace-nowrap text-lax-fg underline underline-offset-2"
              >
                {CONDITIONS_OF_SALE_LABEL}
              </Link>
            </>
          ) : null}
          {help.withBiddingGuide ? (
            <>
              {" "}
              {help.withConditions ? (
                <>
                  <span aria-hidden="true">·</span>{" "}
                </>
              ) : null}
              <Link
                href="/faq"
                className="whitespace-nowrap text-lax-fg underline underline-offset-2"
              >
                How bidding works
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
