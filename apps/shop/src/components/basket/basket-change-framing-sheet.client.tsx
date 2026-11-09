"use client";

import { loadEditionFramingChoices, setBasketLineFraming } from "@/app/actions/basket.actions";
import { FramingSwatch } from "@/components/artwork/artwork-framing-group.client";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { FRAMING_COPY, framingLeadLabel, framingOptionSummary } from "@/content/framing-copy";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import type { PublicEditionFraming } from "@auction/shop-contracts";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";
import { RadioCardGroup } from "@auction/ui";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@auction/ui/components/sheet";
import { useEffect, useState, useTransition } from "react";

const UNFRAMED = "unframed";

type Load =
  | { status: "loading" }
  | { status: "ready"; framing: PublicEditionFraming }
  | { status: "failed" };

/**
 * "Change framing" for a print in the basket: the same choice as on the edition page, in a sheet.
 * The options are read when it opens, so it shows what the edition offers now; a frame that is no
 * longer offered is not listed. Saving sends only the chosen option id.
 */
export function BasketChangeFramingSheet({
  open,
  onOpenChange,
  lineId,
  artworkSlug,
  title,
  currentOptionId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineId: string;
  artworkSlug: string;
  title: string;
  currentOptionId: string | null;
  onSaved: () => void;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [value, setValue] = useState(currentOptionId ?? UNFRAMED);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoad({ status: "loading" });
    setValue(currentOptionId ?? UNFRAMED);
    setError(null);
    loadEditionFramingChoices(artworkSlug)
      .then((framing) => {
        if (!cancelled) setLoad({ status: "ready", framing });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, artworkSlug, currentOptionId]);

  const framing = load.status === "ready" ? load.framing : null;
  const options = framing?.kind === "choose" ? framing.options : [];
  const required = framing?.kind === "choose" && framing.required;
  // A frame that is not on offer now cannot be kept by saving; the shopper picks again.
  const chosenIsListed = value === UNFRAMED ? !required : options.some((o) => o.id === value);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setBasketLineFraming(lineId, value === UNFRAMED ? null : value);
      if (!result.ok) {
        setError(commerceErrorMessage(result.error, "We could not change the framing. Try again."));
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="shop-framing-details">
        <SheetTitle className="shop-framing-details__title">
          {FRAMING_COPY.changeFraming}
        </SheetTitle>
        <SheetDescription className="shop-framing-details__intro">{title}</SheetDescription>

        {load.status === "loading" ? (
          <output className="shop-framing-details__intro">
            Loading the framing for this edition…
          </output>
        ) : null}
        {load.status === "failed" ? (
          <ShopNotice tone="error" title="The framing could not be loaded">
            <p>Close this and try again.</p>
          </ShopNotice>
        ) : null}
        {framing && framing.kind !== "choose" ? (
          <ShopNotice tone="warning" title={FRAMING_COPY.unavailable}>
            <p>
              {framing.kind === "unavailable"
                ? FRAMING_COPY.unavailableDetail
                : "This edition does not offer framing to choose."}
            </p>
          </ShopNotice>
        ) : null}

        {framing?.kind === "choose" ? (
          <RadioCardGroup
            legend={FRAMING_COPY.heading}
            hideLegend
            value={chosenIsListed ? value : ""}
            onValueChange={setValue}
            optionClassName="shop-radio-card shop-framing__card"
            options={[
              ...(required
                ? []
                : [
                    {
                      value: UNFRAMED,
                      label: FRAMING_COPY.unframed,
                      description: FRAMING_COPY.unframedDetail,
                    },
                  ]),
              ...options.map((option) => ({
                value: option.id,
                label: (
                  <>
                    <FramingSwatch frame={option.frame} />
                    {option.name}
                  </>
                ),
                meta: `+${formatGbpPenceForDisplay(option.pricePence)}`,
                description: `${framingOptionSummary(option)} · ${framingLeadLabel(option.leadTimeMinDays, option.leadTimeMaxDays).toLowerCase()}`,
              })),
            ]}
          />
        ) : null}

        {error ? (
          <ShopNotice tone="error" title="The framing was not changed">
            <p>{error}</p>
          </ShopNotice>
        ) : null}

        <div className="shop-framing-details__actions">
          <ShopCommerceButton
            type="button"
            className="w-full"
            disabled={
              pending ||
              framing?.kind !== "choose" ||
              !chosenIsListed ||
              value === (currentOptionId ?? UNFRAMED)
            }
            aria-busy={pending}
            onClick={save}
          >
            {pending ? "Saving…" : "Save framing"}
          </ShopCommerceButton>
          <ShopCommerceButton
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </ShopCommerceButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
