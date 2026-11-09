import {
  FRAME_LABELS,
  FRAMING_COPY,
  framingGlazingLabel,
  framingHangingLabel,
  framingLeadLabel,
  framingMountLabel,
  framingOptionSummary,
} from "@/content/framing-copy";
import type { CheckoutDeliveryTimes } from "@/lib/checkout/checkout-delivery";
import { presentDeliveryLine } from "@/lib/presenters/delivery-estimate.presenter";
import type { PublicEditionFraming, PublicFramingOption } from "@auction/shop-contracts";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/** One thing the shopper can pick: unframed, or a framing option, with everything it changes. */
export type ArtworkFramingChoiceVm = {
  /** The option id, or null for unframed. */
  id: string | null;
  name: string;
  detail: string;
  /** "+£195" for an option; empty for unframed. */
  priceLabel: string;
  /** The price of the print with this choice, "£375". */
  totalLabel: string;
  /** "Adds 10 to 15 working days"; empty for unframed. */
  leadLabel: string;
  /** The delivery line for this choice: dates move by the option's lead time. */
  deliveryLine: string;
  frame: PublicFramingOption["frame"] | null;
};

export type ArtworkFramingDetailsVm = {
  id: string;
  name: string;
  rows: ReadonlyArray<{ label: string; value: string }>;
};

export type ArtworkFramingVm =
  | { kind: "none" }
  | { kind: "framed_by_artist"; description: string }
  | { kind: "unavailable" }
  | {
      kind: "choose";
      required: boolean;
      /** One line under the heading. */
      intro: string;
      /** In order; unframed first unless the edition is sold framed only. */
      choices: ArtworkFramingChoiceVm[];
      /** The choice selected when the page opens: unframed, or null when a frame must be chosen. */
      defaultId: string | null | undefined;
      details: ArtworkFramingDetailsVm[];
    };

function leadRange(options: readonly PublicFramingOption[]): string {
  const min = Math.min(...options.map((option) => option.leadTimeMinDays));
  const max = Math.max(...options.map((option) => option.leadTimeMaxDays));
  return framingLeadLabel(min, max).replace("Adds ", "");
}

/**
 * The framing group on the edition page, worked out on the server: every price, total and
 * delivery date is shown from what shop-api sent, never added up in the browser. Unframed is the
 * default unless the edition is sold framed only.
 */
export function presentArtworkFraming(input: {
  framing: PublicEditionFraming;
  printPricePence: number;
  now: Date;
  times: CheckoutDeliveryTimes;
}): ArtworkFramingVm {
  const { framing, printPricePence, now, times } = input;
  switch (framing.kind) {
    case "none":
      return { kind: "none" };
    case "unavailable":
      return { kind: "unavailable" };
    case "framed_by_artist":
      return framing.description
        ? { kind: "framed_by_artist", description: framing.description }
        : { kind: "none" };
    case "choose": {
      if (framing.options.length === 0) return { kind: "none" };
      const unframed: ArtworkFramingChoiceVm = {
        id: null,
        name: FRAMING_COPY.unframed,
        detail: FRAMING_COPY.unframedDetail,
        priceLabel: "",
        totalLabel: formatGbpPenceForDisplay(printPricePence),
        leadLabel: "",
        deliveryLine: presentDeliveryLine({ now, times }),
        frame: null,
      };
      const framed = framing.options.map(
        (option): ArtworkFramingChoiceVm => ({
          id: option.id,
          name: option.name,
          detail: framingOptionSummary(option),
          priceLabel: `+${formatGbpPenceForDisplay(option.pricePence)}`,
          totalLabel: formatGbpPenceForDisplay(printPricePence + option.pricePence),
          leadLabel: framingLeadLabel(option.leadTimeMinDays, option.leadTimeMaxDays),
          deliveryLine: presentDeliveryLine({
            now,
            times,
            framingLead: { minDays: option.leadTimeMinDays, maxDays: option.leadTimeMaxDays },
          }),
          frame: option.frame,
        }),
      );
      return {
        kind: "choose",
        required: framing.required,
        intro: framing.required
          ? FRAMING_COPY.requiredIntro
          : `Made to order. Adds ${leadRange(framing.options)} to delivery.`,
        choices: framing.required ? framed : [unframed, ...framed],
        defaultId: framing.required ? undefined : null,
        details: framing.options.map((option) => ({
          id: option.id,
          name: option.name,
          rows: [
            { label: FRAMING_COPY.detailsRows.frame, value: FRAME_LABELS[option.frame] },
            { label: FRAMING_COPY.detailsRows.mount, value: framingMountLabel(option.mount) },
            { label: FRAMING_COPY.detailsRows.glazing, value: framingGlazingLabel(option.glazing) },
            { label: FRAMING_COPY.detailsRows.hanging, value: framingHangingLabel(option.hanging) },
            {
              label: FRAMING_COPY.detailsRows.leadTime,
              value: framingLeadLabel(option.leadTimeMinDays, option.leadTimeMaxDays).replace(
                "Adds ",
                "",
              ),
            },
          ],
        })),
      };
    }
  }
}

/** The choice with this id, or null when the page has not chosen one. */
export function choiceById(
  vm: Extract<ArtworkFramingVm, { kind: "choose" }>,
  id: string | null | undefined,
): ArtworkFramingChoiceVm | null {
  if (id === undefined) return null;
  return vm.choices.find((choice) => choice.id === id) ?? null;
}
