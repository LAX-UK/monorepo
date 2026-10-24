import type { Database } from "@auction/db";
import { withAdminIdempotency } from "../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

/** Who is acting, and under which Idempotency-Key. */
export type AdminIdempotency = { idempotencyKey: string; actorSubjectId: string };

/**
 * Runs a writer inside one unit of work that also records the command, so a replayed key returns
 * the first result and a key reused with a different body is rejected. The writer is built on the
 * unit of work's transaction; its own `transaction()` calls become savepoints, so the effect and
 * the command record commit or roll back together.
 */
export function idempotentAdminCommand<C, R>(
  deps: { uow: ShopUnitOfWorkFactory },
  spec: {
    commandType: string;
    run: (db: Database, command: C) => Promise<R>;
  },
): (command: C, ctx: AdminIdempotency) => Promise<R> {
  return (command, ctx) =>
    deps.uow.run((tx) =>
      withAdminIdempotency({
        tx,
        commandType: spec.commandType,
        idempotencyKey: ctx.idempotencyKey,
        actorSubjectId: ctx.actorSubjectId,
        requestPayload: command,
        run: () => spec.run(shopPhaseDbSession(tx), command),
      }),
    );
}
