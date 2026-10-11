import type { ShopStaffRole } from "@auction/shop-domain";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { grantShopStaffRoleInTx, revokeShopStaffRoleInTx } from "../../grant-staff-role.js";
import { resolveActiveProfileByEmail } from "../../resolve-shop-profile-by-email.js";

export type GrantStaffRoleCommand = {
  role: ShopStaffRole;
  operatorSubjectId: string;
  idempotencyKey: string;
} & ({ subject: string } | { email: string });

export type RevokeStaffRoleCommand = {
  subject: string;
  operatorSubjectId: string;
  idempotencyKey: string;
};

export function createGrantStaffRoleHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: GrantStaffRoleCommand) => Promise<{ subject: string }> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "staff.grant",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.operatorSubjectId,
        requestPayload: command,
        run: async () => {
          const db = shopPhaseDbSession(tx);
          const subject =
            "subject" in command
              ? command.subject
              : (await resolveActiveProfileByEmail(db, command.email)).identitySubjectId;
          await grantShopStaffRoleInTx(db, {
            subject,
            role: command.role,
            operatorSubjectId: command.operatorSubjectId,
          });
          return { subject };
        },
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
