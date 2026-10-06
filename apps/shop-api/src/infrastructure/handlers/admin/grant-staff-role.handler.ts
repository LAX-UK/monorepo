import type { ShopStaffRole } from "@auction/shop-domain";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { grantShopStaffRoleInTx, revokeShopStaffRoleInTx } from "../../grant-staff-role.js";

export type GrantStaffRoleCommand = {
  subject: string;
  role: ShopStaffRole;
  operatorSubjectId: string;
  idempotencyKey: string;
};

export type RevokeStaffRoleCommand = {
  subject: string;
  operatorSubjectId: string;
  idempotencyKey: string;
};

export function createGrantStaffRoleHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: GrantStaffRoleCommand) => Promise<void> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "staff.grant",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.operatorSubjectId,
        requestPayload: command,
        run: () =>
          grantShopStaffRoleInTx(shopPhaseDbSession(tx), {
            subject: command.subject,
            role: command.role,
            operatorSubjectId: command.operatorSubjectId,
          }),
      }),
    );
}

export function createRevokeStaffRoleHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: RevokeStaffRoleCommand) => Promise<void> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "staff.revoke",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.operatorSubjectId,
        requestPayload: command,
        run: () =>
          revokeShopStaffRoleInTx(shopPhaseDbSession(tx), {
            subject: command.subject,
            operatorSubjectId: command.operatorSubjectId,
          }),
      }),
    );
}
