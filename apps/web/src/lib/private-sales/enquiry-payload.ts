import type { EnquiryIntakeWire } from "@auction/validators";
import { type EnquiryFormValues, parseLocation, parsePriceInMindMinor } from "./enquiry-values";

export type PayloadContext = {
  /** The checked files to send with a seller's enquiry, in the order shown. */
  uploadIds: readonly string[];
  /** The draft the files were uploaded under, for a visitor who is not signed in. */
  draftToken?: string | undefined;
  /** The organisation chosen in "Enquiring as"; absent for the person's own enquiry. */
  legalEntityId?: string | undefined;
};

const text = (value: string): string | undefined => value.trim() || undefined;

/** The answers as `POST /contact-enquiries` takes them, with every empty optional field left out. */
export function toEnquiryPayload(
  values: EnquiryFormValues,
  context: PayloadContext,
): EnquiryIntakeWire {
  const person = {
    name: values.name.trim(),
    email: values.email.trim(),
    ...(text(values.phone) ? { phone: values.phone.trim() } : {}),
    contactPreference: values.contactPreference as "email" | "phone" | "either",
    marketingOptIn: values.marketingOptIn,
    ...(context.legalEntityId ? { legalEntityId: context.legalEntityId } : {}),
    ...(text(values.notes) ? { message: values.notes.trim() } : {}),
  };

  if (values.path === "buy") {
    return {
      intent: "private_sale_buy",
      ...person,
      lookingFor: values.lookingFor.trim(),
      budgetBand: values.budgetBand as EnquiryBudgetBandWire,
      timing: values.timing as EnquiryTimingWire,
    };
  }

  const place = parseLocation(values.location);
  const price = values.priceNotSure ? undefined : parsePriceInMindMinor(values.price);
  return {
    intent: "private_sale_sell",
    ...person,
    departmentSlug: values.departmentSlug,
    artist: values.artist.trim(),
    title: values.title.trim(),
    ...(text(values.mediumSize) ? { medium: values.mediumSize.trim() } : {}),
    locationTown: place?.town ?? "",
    locationCountry: place?.country ?? "",
    ...(typeof price === "number" ? { priceInMindMinor: price } : {}),
    uploadIds: [...context.uploadIds],
    ...(context.draftToken ? { draftToken: context.draftToken } : {}),
  };
}

type EnquiryBudgetBandWire = Extract<
  EnquiryIntakeWire,
  { intent: "private_sale_buy" }
>["budgetBand"];
type EnquiryTimingWire = Extract<EnquiryIntakeWire, { intent: "private_sale_buy" }>["timing"];
