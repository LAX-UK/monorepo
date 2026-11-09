"use client";

import { useFramingChoice } from "@/components/artwork/artwork-framing-context.client";
import { FRAMING_COPY } from "@/content/framing-copy";
import type {
  ArtworkFramingChoiceVm,
  ArtworkFramingDetailsVm,
} from "@/lib/artwork/artwork-framing.vm";
import { RadioCardGroup } from "@auction/ui";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@auction/ui/components/sheet";
import Link from "next/link";
import { useState } from "react";

const UNFRAMED = "unframed";

/** The colour chip beside a frame's name; the unframed choice has none. */
export function FramingSwatch({ frame }: { frame: ArtworkFramingChoiceVm["frame"] }) {
  if (!frame) return null;
  return <span aria-hidden className="shop-framing__swatch" data-frame={frame} />;
}

function radioValue(id: string | null | undefined): string {
  if (id === undefined) return "";
  return id === null ? UNFRAMED : id;
}

/**
 * The framing group under the price: radio cards, unframed first and chosen by default (or no
 * default when the edition is sold framed only), each with what it is made of, what it adds to the
 * price and how long it takes. "See framing details" opens the full facts. The choice is shared
 * with the picture, the total and the button through the framing context.
 */
export function ArtworkFramingGroup({
  returnsHref,
}: {
  /** The returns policy page when it is live, for the details sheet. */
  returnsHref: string | null;
}) {
  const choice = useFramingChoice();
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!choice) return null;
  const { vm, selectedId, select } = choice;

  return (
    <div className="shop-framing">
      <div className="shop-framing__heading">
        <h2 className="shop-framing__title">{FRAMING_COPY.heading}</h2>
        <button
          type="button"
          className="shop-inline-link shop-focus-ring shop-framing__details-link"
          aria-haspopup="dialog"
          onClick={() => setDetailsOpen(true)}
        >
          {FRAMING_COPY.detailsLink}
        </button>
      </div>
      <p className="shop-framing__intro">{vm.intro}</p>
      <RadioCardGroup
        legend={FRAMING_COPY.heading}
        hideLegend
        value={radioValue(selectedId)}
        onValueChange={(value) => select(value === UNFRAMED ? null : value)}
        optionClassName="shop-radio-card shop-framing__card"
        options={vm.choices.map((entry) => ({
          value: radioValue(entry.id),
          label: (
            <>
              <FramingSwatch frame={entry.frame} />
              {entry.name}
            </>
          ),
          ...(entry.priceLabel ? { meta: entry.priceLabel } : {}),
          description: entry.detail,
        }))}
      />
      <FramingDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        details={vm.details}
        returnsHref={returnsHref}
      />
    </div>
  );
}

function FramingDetailsSheet({
  open,
  onOpenChange,
  details,
  returnsHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: readonly ArtworkFramingDetailsVm[];
  returnsHref: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="shop-framing-details">
        <SheetTitle className="shop-framing-details__title">{FRAMING_COPY.detailsTitle}</SheetTitle>
        <SheetDescription className="shop-framing-details__intro">
          {FRAMING_COPY.detailsIntro}
        </SheetDescription>
        <div className="shop-framing-details__list">
          {details.map((option) => (
            <section
              key={option.id}
              aria-label={option.name}
              className="shop-framing-details__option"
            >
              <h3 className="shop-framing-details__name">{option.name}</h3>
              <dl className="shop-framing-details__rows">
                {option.rows.map((row) => (
                  <div key={row.label} className="shop-framing-details__row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="shop-framing-details__note">
          {FRAMING_COPY.detailsReturns}{" "}
          {returnsHref ? (
            <Link href={returnsHref} className="shop-inline-link shop-focus-ring">
              {FRAMING_COPY.returnsLink}
            </Link>
          ) : null}
        </p>
      </SheetContent>
    </Sheet>
  );
}
