import {
  type UnsoldLotChoice,
  type UnsoldLotChoiceKind,
  unsoldLotChoiceKinds,
} from "@auction/types";
import type { UnsoldLotChoiceDecisionBody } from "@auction/validators";
import { z } from "zod";

/** The specialist's confirmation as the form holds it: amounts as pounds strings, "" for none. */
export const unsoldChoiceFormSchema = z.object({
  choice: z.enum(["", ...unsoldLotChoiceKinds]).superRefine((value, ctx) => {
    if (value === "") ctx.addIssue({ code: "custom", message: "Choose what happens next" });
  }),
  reserve: z.string(),
  note: z.string().trim().max(1000, "Keep the note under 1,000 characters"),
});

export type UnsoldChoiceFormValues = z.infer<typeof unsoldChoiceFormSchema>;

/** Starts from what the seller asked, so confirming as asked is one click. */
export function unsoldChoiceFormDefaults(choice: UnsoldLotChoice | null): UnsoldChoiceFormValues {
  return {
    choice: choice?.requestedChoice ?? "",
    reserve: choice?.requestedReserve ?? "",
    note: "",
  };
}

export function unsoldChoiceDecisionBody(
  values: UnsoldChoiceFormValues,
): UnsoldLotChoiceDecisionBody {
  // The schema refuses an empty choice before this runs.
  return {
    choice: values.choice as UnsoldLotChoiceKind,
    reserve: values.choice === "relist" && values.reserve ? values.reserve : null,
    note: values.note ? values.note : null,
  };
}

export const STAFF_UNSOLD_CHOICE_OPTIONS: ReadonlyArray<{
  value: UnsoldLotChoiceKind;
  label: string;
  description: string;
}> = [
  {
    value: "relist",
    label: "Relist",
    description: "Return the lot to inventory for a future sale.",
  },
  { value: "private_sale", label: "Private sale", description: "Offer it to buyers directly." },
  {
    value: "collect",
    label: "Return to the seller",
    description: "Arrange collection or delivery.",
  },
];
