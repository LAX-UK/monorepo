"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { LOT_FULFILMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { ServiceResult } from "@/lib/services/http/service-result";
import {
  lotFulfilmentCollectBodySchema,
  lotFulfilmentReleaseBodySchema,
  lotFulfilmentShipBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const lotIdSchema = z.string().uuid();

/**
 * Runs one fulfilment step for a lot: checks the role, the lot id and the body, calls the API,
 * and refreshes the fulfilment queue and payments. Failures come back as a result, never a
 * redirect, so the dialog that asked can keep them in view.
 */
async function runStep(
  name: string,
  lotId: string,
  call: (id: string) => Promise<ServiceResult<unknown>>,
): Promise<ActionResult<void>> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(LOT_FULFILMENT_ACCESS);
    if (denied) return denied;
    const id = lotIdSchema.safeParse(lotId);
    if (!id.success) return actionFailure("This lot could not be found.");
    const res = await call(id.data);
    if (!res.ok) return actionFailure(res.message, undefined, res.status, res.code);
    revalidatePath("/admin/lot-fulfilment");
    revalidatePath("/admin/payments");
    return actionSuccess();
  });
}

export async function adminLotFulfilmentReleaseResultAction(
  lotId: string,
  values: { notes?: string },
): Promise<ActionResult<void>> {
  const notes = values.notes?.trim();
  const body = lotFulfilmentReleaseBodySchema.safeParse(notes ? { notes } : {});
  if (!body.success) {
    return actionFailure(firstZodErrorMessage(body.error), zodErrorToFieldErrors(body.error));
  }
  return runStep("adminLotFulfilmentReleaseResultAction", lotId, (id) =>
    getWriteContainer().adminLotFulfilment.release(id, body.data),
  );
}

export async function adminLotFulfilmentShipResultAction(
  lotId: string,
  values: { carrier: string; trackingNumber: string },
): Promise<ActionResult<void>> {
  const body = lotFulfilmentShipBodySchema.safeParse({
    carrier: values.carrier.trim(),
    trackingNumber: values.trackingNumber.trim(),
  });
  if (!body.success) {
    return actionFailure(firstZodErrorMessage(body.error), zodErrorToFieldErrors(body.error));
  }
  return runStep("adminLotFulfilmentShipResultAction", lotId, (id) =>
    getWriteContainer().adminLotFulfilment.ship(id, body.data),
  );
}

export async function adminLotFulfilmentReadyForCollectionResultAction(
  lotId: string,
): Promise<ActionResult<void>> {
  return runStep("adminLotFulfilmentReadyForCollectionResultAction", lotId, (id) =>
    getWriteContainer().adminLotFulfilment.readyForCollection(id),
  );
}

export async function adminLotFulfilmentDeliveredResultAction(
  lotId: string,
): Promise<ActionResult<void>> {
  return runStep("adminLotFulfilmentDeliveredResultAction", lotId, (id) =>
    getWriteContainer().adminLotFulfilment.delivered(id),
  );
}

export async function adminLotFulfilmentCollectedResultAction(
  lotId: string,
  values: { collectedBy: string },
): Promise<ActionResult<void>> {
  const body = lotFulfilmentCollectBodySchema.safeParse({
    collectedBy: values.collectedBy.trim(),
  });
  if (!body.success) {
    return actionFailure(firstZodErrorMessage(body.error), zodErrorToFieldErrors(body.error));
  }
  return runStep("adminLotFulfilmentCollectedResultAction", lotId, (id) =>
    getWriteContainer().adminLotFulfilment.collected(id, body.data),
  );
}
