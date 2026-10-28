"use server";

import { mapServiceToActionVoid } from "@/lib/actions/map-service-result";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getAdminConsignmentMoveOptions } from "@/lib/data/http/consignment-after-sale.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { ConsignmentMoveOptions } from "@auction/types";
import {
  consignmentMoveBodySchema,
  relistReserveFloorBodySchema,
  unsoldLotChoiceDecisionBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

function refresh(id: string) {
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${id}`, "layout");
}

/** Runs a staff write on a submission: capability, a parsed body, then the service call. */
async function staffWrite<S extends z.ZodTypeAny>(
  submissionId: string,
  schema: S,
  values: unknown,
  run: (id: string, body: z.output<S>) => Promise<ActionResult<void>>,
): Promise<ActionResult<void>> {
  const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
  if (denied) return denied;
  const id = submissionId.trim();
  if (!id) return actionFailure("Missing submission");
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const result = await run(id, parsed.data);
  if (result.ok) refresh(id);
  return result;
}

export async function adminDecideUnsoldChoiceAction(
  submissionId: string,
  values: { choice: string; reserve?: string | null; note?: string | null },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminDecideUnsoldChoiceAction", () =>
    staffWrite(submissionId, unsoldLotChoiceDecisionBodySchema, values, async (id, body) =>
      mapServiceToActionVoid(
        await getWriteContainer().adminConsignmentAfterSale.decideUnsoldChoice(id, body),
      ),
    ),
  );
}

export async function adminSetRelistReserveFloorAction(
  submissionId: string,
  floor: string | null,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSetRelistReserveFloorAction", () =>
    staffWrite(submissionId, relistReserveFloorBodySchema, { floor }, async (id, body) =>
      mapServiceToActionVoid(
        await getWriteContainer().adminConsignmentAfterSale.setRelistReserveFloor(id, body.floor),
      ),
    ),
  );
}

export async function adminMoveConsignmentAction(
  submissionId: string,
  legalEntityId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminMoveConsignmentAction", () =>
    staffWrite(submissionId, consignmentMoveBodySchema, { legalEntityId }, async (id, body) =>
      mapServiceToActionVoid(await getWriteContainer().adminConsignmentAfterSale.move(id, body)),
    ),
  );
}

/** The seller's organisations a personal consignment can move to, read when the dialog opens. */
export async function adminConsignmentMoveOptionsAction(
  submissionId: string,
): Promise<ActionResult<ConsignmentMoveOptions>> {
  return instrumentServerAction("adminConsignmentMoveOptionsAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const options = await getAdminConsignmentMoveOptions(submissionId.trim());
    if (!options) return actionFailure("The seller's organisations could not be loaded.");
    return actionSuccess(options);
  });
}

/** Reminds the seller to verify their identity; at most once a day, so a repeat sends nothing. */
export async function adminRemindSellerIdentityAction(
  submissionId: string,
): Promise<ActionResult<{ sent: boolean }>> {
  return instrumentServerAction("adminRemindSellerIdentityAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const id = submissionId.trim();
    if (!id) return actionFailure("Missing submission");
    const r = await getWriteContainer().adminConsignmentAfterSale.remindSeller(id);
    if (!r.ok) return actionFailure(r.message, undefined, r.status, r.code);
    refresh(id);
    return actionSuccess({ sent: r.data.sent });
  });
}
