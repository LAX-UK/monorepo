import { soldWorks } from "@/lib/departments/department-evidence";
import {
  type SellDepartment,
  departmentIntakeHref,
  visibleSellDepartmentGroups,
} from "@/lib/marketing/sell-departments";
import { legalEntityFor } from "@auction/branding";
import type { Lot } from "@auction/types";

export const SELL_LANDING_PATH = "/sell";
export const SELL_HOW_TO_SELL_PATH = "/sell/how-to-sell";

export const SELL_HERO_TITLE = "Sell with LAX Bid";
export const SELL_HERO_LEAD = "Free valuations from our specialists, and no obligation to sell.";
export const SELL_TALK_LABEL = "Talk to a specialist";

/** Section anchors on the page; the first three keep the ids the old guide used. */
export const SELL_SECTION_IDS = {
  recentlySold: "recently-sold",
  howItWorks: "how-it-works",
  departments: "departments",
  fees: "fees",
  specialists: "specialists",
  faq: "questions",
} as const;

/** The most works the Recently sold row shows. */
export const RECENTLY_SOLD_LIMIT = 8;

/**
 * Sold works for the row: works with a picture come first, since a row of empty frames says
 * nothing; order within each group is kept (most recently sold first).
 */
export function recentlySoldWorks(lots: readonly Lot[], limit = RECENTLY_SOLD_LIMIT): Lot[] {
  const sold = soldWorks(lots, lots.length).map(({ lot }) => lot);
  const withPicture = sold.filter((lot) => lot.images.length > 0);
  const withoutPicture = sold.filter((lot) => lot.images.length === 0);
  return [...withPicture, ...withoutPicture].slice(0, limit);
}

export type SellDepartmentCard = {
  id: string;
  label: string;
  examples: string | null;
  href: string;
  /** True when the card opens a department page rather than the form. */
  opensDepartmentPage: boolean;
};

function departmentCard(department: SellDepartment): SellDepartmentCard {
  return {
    id: department.id,
    label: department.label,
    examples: department.examples?.join(" · ") ?? null,
    href: department.landing ?? departmentIntakeHref(department),
    opensDepartmentPage: Boolean(department.landing),
  };
}

/** Every department shown to visitors, in the order of the department table. */
export function sellDepartmentCards(): SellDepartmentCard[] {
  return visibleSellDepartmentGroups().flatMap((group) => group.departments.map(departmentCard));
}

/** What selling costs, in plain words: no rate is published. */
export const SELL_FEES_POINTS = [
  "It is free to send us a work, and a valuation costs nothing.",
  "If your work sells, we take a commission from the hammer price. We agree it with you in writing before the sale.",
  "Photography, storage or shipping costs are agreed with you in advance.",
  "We pay you after the buyer has paid.",
] as const;

/** Who runs the product and what is checked, with the company named from the shared registry. */
export function sellTrustLine(): string {
  const entity = legalEntityFor("bid");
  const street = entity.registeredAddress.lines[0] ?? entity.registeredAddress.inline;
  return `LAX Bid is run by ${entity.name}, ${street}. We check the identity of every buyer.`;
}

/** Questions from the FAQ's selling group shown on the page, in this order. */
export const SELL_FAQ_IDS = [
  "consign-work",
  "seller-fees",
  "estimate-determined",
  "reserve-price",
  "seller-payment",
  "unsold-item",
] as const;
