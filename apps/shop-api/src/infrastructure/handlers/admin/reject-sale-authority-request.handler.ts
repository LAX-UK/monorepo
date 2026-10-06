import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { rejectSaleAuthorityRequest } from "../../reject-sale-authority-request.js";

export type RejectSaleAuthorityRequestCommand = {
  requestId: string;
  reason: string;
  operatorSubjectId: string;
  idempotencyKey: string;
};

export function createRejectSaleAuthorityRequestHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (
  command: RejectSaleAuthorityRequestCommand,
) => Promise<{ requestId: string; status: "rejected" }> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "sale_authority.decline",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.operatorSubjectId,
        requestPayload: command,
        run: () =>
          rejectSaleAuthorityRequest(shopPhaseDbSession(tx), {
            requestId: command.requestId,
            reason: command.reason,
            operatorSubjectId: command.operatorSubjectId,
          }),
      }),
    );
}
