"use server";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { SALE_COVER_SLOT_NAMES } from "@auction/types";
import {
  replaceHomePinsBodySchema,
  setSaleCoverSlotBodySchema,
  updateSaleHomeBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const saveSaleCoverSchema = z.object({
  puts: z.array(
    z.object({ name: z.enum(SALE_COVER_SLOT_NAMES), body: setSaleCoverSlotBodySchema }),
  ),
  clears: z.array(z.enum(SALE_COVER_SLOT_NAMES)),
  home: updateSaleHomeBodySchema.nullable(),
  pins: replaceHomePinsBodySchema.shape.saleIds.nullable(),
});

export type SaveSaleCoverInput = z.input<typeof saveSaleCoverSchema>;

/**
 * Saves what staff changed on a sale's cover and home controls: each changed slot, the cleared
 * slots, the home fields and the pin list, in that order. It stops at the first part the server
 * refuses and says which, so the person fixes it and saves again; parts already saved stay saved.
 */
export async function adminSaveSaleCoverAction(
  saleId: string,
  input: SaveSaleCoverInput,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaveSaleCoverAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = saleId.trim();
    if (!id) return actionFailure("Missing sale");
    const parsed = saveSaleCoverSchema.safeParse(input);
    if (!parsed.success) return actionFailure(firstZodErrorMessage(parsed.error));
    const { puts, clears, home, pins } = parsed.data;
    const { adminSaleCover } = getWriteContainer();

    const fail = (
      result: { message: string; status: number; code?: string; body?: unknown },
      part: string,
    ) =>
      actionFailure(
        `${part}: ${result.message}`,
        undefined,
        result.status,
        result.code,
        readApiActionErrorMeta(result.body),
      );

    for (const { name, body } of puts) {
      const result = await adminSaleCover.setSlot(id, name, body);
      if (!result.ok) return fail(result, `The ${name} cover was not saved`);
    }
    for (const name of clears) {
      const result = await adminSaleCover.clearSlot(id, name);
      if (!result.ok) return fail(result, `The ${name} cover was not removed`);
    }
    if (home) {
      const result = await adminSaleCover.updateHome(id, home);
      if (!result.ok) return fail(result, "The home settings were not saved");
    }
    if (pins) {
      const result = await adminSaleCover.replacePins({ saleIds: pins });
      if (!result.ok) return fail(result, "The home pin was not saved");
    }

    revalidateAdminSaleDetail(id);
    revalidatePath(`/admin/sales/${id}/cover`);
    revalidatePath("/");
    return actionSuccess();
  });
}
