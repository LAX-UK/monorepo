import { type WorkingDayWindow, workingDaysLabel } from "@/lib/checkout/checkout-delivery";
import { GALLERY_CONTACT } from "@auction/branding";
import type { DeliveryRegionView, PublicDeliveryRegions } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE, formatLeadTime } from "@auction/shop-domain";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/*
 * "Delivery at a glance": the plain answer printed above the Shop's delivery policy. Every figure
 * has one source, the one the rest of the Shop already uses:
 *  - the UK price is what checkout charges (`FULFILMENT_SURCHARGE_PENCE`) and the UK time is the
 *    window the edition page and checkout show (`loadCheckoutDeliveryTimes`);
 *  - the other regions' lead times and prices, and the countries we do not deliver to, are the
 *    delivery-regions API's (the data LAX Admin edits);
 *  - the address, hours and contact are the gallery's, from the branding package.
 * The policy's legal text is not touched and is not repeated here.
 */

export const DELIVERY_GLANCE_ID = "delivery-at-a-glance";

/** A section of a policy page, in the shape the shared legal layout renders. */
export type GlanceSection = {
  id: string;
  heading: string;
  blocks: readonly GlanceBlock[];
};

export type GlanceBlock =
  | { type: "paragraph"; text: string }
  | { type: "subheading"; text: string }
  | { type: "list"; items: readonly string[] }
  | { type: "table"; caption: string; columns: readonly string[]; rows: readonly string[][] }
  | { type: "panel"; title: string; blocks: readonly GlanceBlock[] };

export type DeliveryGlanceInput = {
  /** The delivery regions, or `null` when they could not be read. */
  regions: PublicDeliveryRegions | null;
  /** The UK delivery window checkout and the edition page show; `null` when none is configured. */
  ukDelivery: WorkingDayWindow | null;
  /** Whether the Shop offers framing: the framing lines show only then. */
  framingEnabled: boolean;
};

const UK_ID = "uk";

/** What checkout charges for UK delivery. */
function ukPrice(): string {
  return formatGbpPenceForDisplay(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery);
}

function collectionPrice(): string {
  const pence = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish;
  return pence === 0 ? "Free" : formatGbpPenceForDisplay(pence);
}

function galleryAddress(): string {
  return `${GALLERY_CONTACT.streetLine}, ${GALLERY_CONTACT.city} ${GALLERY_CONTACT.postcode}`;
}

/** "Insured delivery, £15. Usually 3 to 5 working days." (no time when none is configured). */
function ukSentence(ukDelivery: WorkingDayWindow | null): string {
  const time = ukDelivery ? ` Usually ${workingDaysLabel(ukDelivery)}.` : "";
  return `Insured delivery, ${ukPrice()}.${time}`;
}

/** "3 to 5" for a window, as the table's cells say it. */
function windowSpan(window: WorkingDayWindow | null): string {
  if (!window) return "Not stated";
  return window.min === window.max ? String(window.min) : `${window.min} to ${window.max}`;
}

/** The country names as one phrase: "Belarus, Iran and Russia". */
function joinNames(names: readonly string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function regionsTable(
  regions: readonly DeliveryRegionView[],
  ukDelivery: WorkingDayWindow | null,
): GlanceBlock {
  // A price column appears only once a region outside the UK has a fixed price.
  const showPrice = regions.some(
    (region) => region.id !== UK_ID && region.fixedPricePence !== null,
  );
  return {
    type: "table",
    caption: "Typical delivery times by region, in working days",
    columns: [
      "Region",
      "Standard",
      "Specialist handling",
      ...(showPrice ? ["Delivery price"] : []),
    ],
    rows: regions.map((region) => {
      const isUk = region.id === UK_ID;
      const price = isUk
        ? ukPrice()
        : region.fixedPricePence === null
          ? "Quote"
          : formatGbpPenceForDisplay(region.fixedPricePence);
      return [
        region.name,
        isUk ? windowSpan(ukDelivery) : formatLeadTime(region.standard),
        formatLeadTime(region.specialist),
        ...(showPrice ? [price] : []),
      ];
    }),
  };
}

function regionsUnavailable(): GlanceBlock {
  return {
    type: "paragraph",
    text: `We can't show delivery times for other regions just now. Please try again shortly, or email ${GALLERY_CONTACT.email} or call ${GALLERY_CONTACT.phone}.`,
  };
}

/**
 * The section for the delivery page. When the regions could not be read, everything that does not
 * depend on them still shows (the UK, collection, duties, insurance, release) and the other
 * regions' times say they are unavailable instead of guessing.
 */
export function buildDeliveryGlance(input: DeliveryGlanceInput): GlanceSection {
  const { regions, ukDelivery, framingEnabled } = input;
  const notDelivered = regions?.notDeliveredTo.map((country) => country.name) ?? [];

  const summary: string[] = [
    `**In the UK:** ${ukSentence(ukDelivery)}`,
    `**Collection:** ${collectionPrice()}, by appointment, at ${galleryAddress()}.`,
    "**Outside the UK:** Priced by quote within one working day. Your print is held for you meanwhile.",
  ];

  return {
    id: DELIVERY_GLANCE_ID,
    heading: "Delivery at a glance",
    blocks: [
      { type: "paragraph", text: "The full policy follows below." },
      { type: "panel", title: "At a glance", blocks: [{ type: "list", items: summary }] },
      { type: "subheading", text: "In the UK" },
      {
        type: "paragraph",
        text: `${ukSentence(ukDelivery)}${framingEnabled ? " A framed print leaves us after framing." : ""}`,
      },
      { type: "subheading", text: "Collection" },
      {
        type: "paragraph",
        text: `${collectionPrice()}. Collect by appointment from ${GALLERY_CONTACT.name}, ${galleryAddress()}. ${GALLERY_CONTACT.openingHours} Call ${GALLERY_CONTACT.phone} or email ${GALLERY_CONTACT.email} to arrange a time.`,
      },
      { type: "subheading", text: "Outside the UK" },
      {
        type: "paragraph",
        text: "Ask for a quote at checkout. We reply by email within one working day with one price for packing, insured delivery and export paperwork. You pay for your order and delivery together once you accept it.",
      },
      ...(regions
        ? [
            { type: "paragraph" as const, text: "Typical times, in working days:" },
            regionsTable(regions.regions, ukDelivery),
            {
              type: "paragraph" as const,
              text: "Times are a guide and start once payment has cleared. Customs can add time.",
            },
          ]
        : [regionsUnavailable()]),
      ...(notDelivered.length > 0
        ? [
            {
              type: "paragraph" as const,
              text: `We can't deliver to ${joinNames(notDelivered)}. You can collect from our London gallery instead.`,
            },
          ]
        : []),
      ...(framingEnabled
        ? [
            { type: "subheading" as const, text: "Framed prints" },
            {
              type: "paragraph" as const,
              text: "Frames we make use UV-filtering acrylic. Framing adds the time shown on the edition page.",
            },
          ]
        : []),
      { type: "subheading", text: "Duties and insurance" },
      {
        type: "paragraph",
        text: "Import duties, taxes and customs charges in your country are paid by you. Every delivery we arrange is insured for the price you paid, included in your delivery price or quote.",
      },
      { type: "subheading", text: "Before anything leaves us" },
      {
        type: "paragraph",
        text: "We release a print only after cleared payment. Someone collecting for you needs your written authority and photo ID.",
      },
    ],
  };
}
