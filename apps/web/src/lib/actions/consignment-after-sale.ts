"use server";

import { mapServiceToActionVoid } from "@/lib/actions/map-service-result";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { unsoldLotChoiceRequestBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

function refresh(id: string) {
  revalidatePath(`/selling/consignments/${id}`);
  revalidatePath("/selling");
}

/** The seller's choice for a lot that did not sell; a specialist confirms it. */
export async function requestUnsoldChoiceAction(
  submissionId: string,
  values: { choice: string; reserve?: string | null },
): Promise<ActionResult<void>> {
  return instrumentServerAction("requestUnsoldChoiceAction", async () => {
    const id = submissionId.trim();
    const parsed = unsoldLotChoiceRequestBodySchema.safeParse(values);
    if (!id) return actionFailure("Open the consignment again and choose.");
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const mapped = mapServiceToActionVoid(
      await getWriteContainer().consignmentAfterSale.requestUnsoldChoice(id, parsed.data),
    );
    if (mapped.ok) refresh(id);
    return mapped;
  });
}

/** Withdraws a consignment before cataloguing, or asks staff to withdraw a catalogued lot. */
export async function withdrawConsignmentAction(
  submissionId: string,
): Promise<ActionResult<{ kind: "withdrawn" | "requested" }>> {
  return instrumentServerAction("withdrawConsignmentAction", async () => {
    const id = submissionId.trim();
    if (!id) return actionFailure("Open the consignment again and try once more.");
    const r = await getWriteContainer().consignmentAfterSale.withdraw(id);
    if (!r.ok) return actionFailure(r.message, undefined, r.status, r.code);
    refresh(id);
    return actionSuccess(r.data);
  });
}
