import { type SaleSoftDeleteContext, listSaleSoftDeleteBlockers } from "@auction/domain";
import { type Result, err, ok } from "neverthrow";
import { LotError } from "../lib/errors.js";

export type { SaleSoftDeleteContext } from "@auction/domain";
export { canSaleSoftDelete, listSaleSoftDeleteBlockers } from "@auction/domain";

export function validateSaleSoftDelete(ctx: SaleSoftDeleteContext): Result<void, LotError> {
  if (ctx.sale.deletedAt) {
    return err(new LotError("Sale not found", 404));
  }

  const blockers = listSaleSoftDeleteBlockers(ctx);
  const firstBlocker = blockers[0];
  if (firstBlocker) {
    return err(new LotError(firstBlocker, 422));
  }

  return ok(undefined);
}
