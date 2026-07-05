import { type LotSoftDeleteContext, listLotSoftDeleteBlockers } from "@auction/domain";
import { type Result, err, ok } from "neverthrow";
import { LotError } from "../lib/errors.js";

export type { LotSoftDeleteContext } from "@auction/domain";
export { canLotSoftDelete, listLotSoftDeleteBlockers } from "@auction/domain";

export function validateLotSoftDelete(ctx: LotSoftDeleteContext): Result<void, LotError> {
  if (ctx.lot.deletedAt) {
    return err(new LotError("Lot not found", 404));
  }

  const blockers = listLotSoftDeleteBlockers(ctx);
  const firstBlocker = blockers[0];
  if (firstBlocker) {
    return err(new LotError(firstBlocker, 422));
  }

  return ok(undefined);
}
