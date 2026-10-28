"use server";

import { mapServiceToActionVoid } from "@/lib/actions/map-service-result";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { acceptConsignmentAgreementBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

/** Accepts the consignment agreement for a consignment, at the version the person read. */
export async function acceptConsignmentAgreementAction(
  submissionId: string,
  termsVersion: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("acceptConsignmentAgreementAction", async () => {
    const id = submissionId.trim();
    const body = acceptConsignmentAgreementBodySchema.safeParse({ termsVersion });
    if (!id || !body.success) return actionFailure("Open the agreement again and accept it.");
    const { submissions } = getWriteContainer();
    const mapped = mapServiceToActionVoid(
      await submissions.acceptAgreement(id, body.data.termsVersion),
    );
    if (mapped.ok) {
      revalidatePath(`/selling/consignments/${id}`);
      revalidatePath("/selling");
    }
    return mapped;
  });
}
