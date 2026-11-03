import type { EnquiryPath } from "./enquiry-values";

/** An organisation the signed-in person may send an enquiry for, as the API lists it. */
export type EnquirerOrganisation = {
  id: string;
  name: string;
  role: string;
  canBuy: boolean;
  canSell: boolean;
};

export type EnquiringAsChoice = {
  id: string;
  label: string;
  /** Sent with the enquiry; absent when the person enquires as themselves. */
  legalEntityId: string | undefined;
};

const SELF: EnquiringAsChoice = { id: "self", label: "Myself", legalEntityId: undefined };

const MAY_ENQUIRE: Record<EnquiryPath, (organisation: EnquirerOrganisation) => boolean> = {
  buy: (organisation) => organisation.canBuy,
  sell: (organisation) => organisation.canSell,
};

/** Who the person may send this path's enquiry as: themselves, or an organisation that allows it. */
export function enquiringAsChoices(
  path: EnquiryPath,
  organisations: readonly EnquirerOrganisation[],
): EnquiringAsChoice[] {
  return [
    SELF,
    ...organisations
      .filter(MAY_ENQUIRE[path])
      .map((o) => ({ id: o.id, label: o.name, legalEntityId: o.id })),
  ];
}

/** The chosen entry, or the person alone when it is not offered (a path change can remove it). */
export function resolveChoice(
  path: EnquiryPath,
  organisations: readonly EnquirerOrganisation[],
  chosenId: string | undefined,
): EnquiringAsChoice {
  const choices = enquiringAsChoices(path, organisations);
  return choices.find((choice) => choice.id === chosenId) ?? SELF;
}
