import { GALLERY_CONTACT } from "@auction/branding";
import type { DeliveryRegionView, PublicDeliveryRegions } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE, formatLeadTime } from "@auction/shop-domain";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/*
 * "Delivery at a glance": the plain answer printed above the Shop's delivery policy. Every figure
 * comes from one place: the regions, lead times and prices from the delivery-regions API (the
 * same data checkout and LAX Admin use), the gallery's address, hours and contact from the
 * branding package. The policy's legal text is not touched and is not repeated here.
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

const UK_ID = "uk";

function collectionPrice(): string {
  const pence = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish;
  return pence === 0 ? "Free" : formatGbpPenceForDisplay(pence);
}

function galleryAddress(): string {
  return `${GALLERY_CONTACT.streetLine}, ${GALLERY_CONTACT.city} ${GALLERY_CONTACT.postcode}`;
}

/** "Insured delivery, £15" for a region with a fixed price, "We quote delivery" without one. */
function priceSentence(region: DeliveryRegionView): string {
  return region.fixedPricePence === null
    ? "We quote delivery"
    : `Insured delivery, ${formatGbpPenceForDisplay(region.fixedPricePence)}`;
}

function ukSentence(uk: DeliveryRegionView): string {
  return `${priceSentence(uk)}. Usually ${formatLeadTime(uk.standard)} working days after dispatch.`;
}

/** The country names as one phrase: "Belarus, Iran and Russia". */
function joinNames(names: readonly string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function regionsTable(regions: readonly DeliveryRegionView[]): GlanceBlock {
  // A price column appears only once a region outside the UK has a fixed price.
  const showPrice = regions.some(
    (region) => region.id !== UK_ID && region.fixedPricePence !== null,
  );
  return {
    type: "table",
    caption: "Typical delivery times by region, in working days after dispatch",
    columns: [
      "Region",
      "Standard",
      "Specialist handling",
      ...(showPrice ? ["Delivery price"] : []),
    ],
    rows: regions.map((region) => [
      region.name,
      formatLeadTime(region.standard),
      formatLeadTime(region.specialist),
      ...(showPrice
        ? [
            region.fixedPricePence === null
              ? "Quote"
              : formatGbpPenceForDisplay(region.fixedPricePence),
          ]
        : []),
    ]),
  };
}

function unavailableBlock(): GlanceBlock {
  return {
    type: "paragraph",
    text: `We can't show delivery times just now. Please try again shortly, or email ${GALLERY_CONTACT.email} or call ${GALLERY_CONTACT.phone}.`,
  };
}

/**
 * The section for the delivery page. `regions` is `null` when the regions could not be read: the
 * facts that do not depend on them (collection, duties, insurance, release) still show, and the
 * times say they are unavailable instead of guessing.
 */
export function buildDeliveryGlance(regions: PublicDeliveryRegions | null): GlanceSection {
  const uk = regions?.regions.find((region) => region.id === UK_ID) ?? null;
  const notDelivered = regions?.notDeliveredTo.map((country) => country.name) ?? [];

  const summary: string[] = [
    ...(uk ? [`**In the UK:** ${ukSentence(uk)}`] : []),
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
      uk
        ? {
            type: "paragraph",
            text: `${ukSentence(uk)} Specialist handling takes ${formatLeadTime(uk.specialist)}. A framed print leaves us after framing.`,
          }
        : unavailableBlock(),
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
      ...(regions && uk
        ? [
            { type: "paragraph" as const, text: "Typical times, in working days after dispatch:" },
            regionsTable(regions.regions),
            {
              type: "paragraph" as const,
              text: "Times are a guide and start once payment has cleared. Customs can add time.",
            },
          ]
        : []),
      ...(notDelivered.length > 0
        ? [
            {
              type: "paragraph" as const,
              text: `We can't deliver to ${joinNames(notDelivered)}. You can collect from our London gallery instead.`,
            },
          ]
        : []),
      { type: "subheading", text: "Framed prints" },
      {
        type: "paragraph",
        text: "Framed prints are glazed with acrylic so they travel safely. Framing adds the time shown on the edition page.",
      },
      { type: "subheading", text: "Duties and insurance" },
      {
        type: "paragraph",
        text: "Import duties, taxes and customs charges in your country are paid by you. Every delivery we arrange is insured for the price you paid, and the cost is in your quote.",
      },
      { type: "subheading", text: "Before anything leaves us" },
      {
        type: "paragraph",
        text: "We release a print only after cleared payment. Someone collecting for you needs your written authority and photo ID.",
      },
      {
        type: "paragraph",
        text: `Questions about delivery? Email ${GALLERY_CONTACT.email} or call ${GALLERY_CONTACT.phone}. ${GALLERY_CONTACT.openingHours}`,
      },
    ],
  };
}
