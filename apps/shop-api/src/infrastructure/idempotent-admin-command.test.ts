import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  AdminCommandBeginInput,
  ShopAdminCommandWriter,
} from "../application/ports/shop-admin-command.writer.js";
import type {
  ShopTransactionEffects,
  ShopUnitOfWorkFactory,
} from "../application/ports/shop-unit-of-work.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { idempotentAdminCommand } from "./idempotent-admin-command.js";

/**
 * Keeps commands the way the table does: one row per type, actor and key, a different payload
 * under the same key is a conflict, and a completed row replays its stored result. A failed run
 * rolls the row back with the rest of the transaction.
 */
function createFakeUnitOfWork(): ShopUnitOfWorkFactory {
  const rows = new Map<string, { hash: string; result: unknown; done: boolean }>();
  const rowKey = (input: { commandType: string; actorSubjectId: string; idempotencyKey: string }) =>
    `${input.commandType}|${input.actorSubjectId}|${input.idempotencyKey}`;

  return {
    async run(fn) {
      const pending = new Map(rows);
      const commands: ShopAdminCommandWriter = {
        async begin(input: AdminCommandBeginInput) {
          const existing = pending.get(rowKey(input));
          if (!existing) {
            pending.set(rowKey(input), { hash: input.requestHash, result: null, done: false });
            return { kind: "started" };
          }
          if (existing.hash !== input.requestHash) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
              "Idempotency key reused with a different payload",
              409,
            );
          }
          return existing.done ? { kind: "replay", result: existing.result } : { kind: "conflict" };
        },
        async complete(input) {
          const row = pending.get(rowKey(input));
          if (row) {
            row.result = JSON.parse(JSON.stringify(input.result));
            row.done = true;
          }
        },
      };
      const tx = { session: {}, commands } as unknown as ShopTransactionEffects;
      const result = await fn(tx);
      rows.clear();
      for (const [key, value] of pending) rows.set(key, value);
      return result;
    },
  };
}

const ctx = { idempotencyKey: "idem-key-0001", actorSubjectId: "actor-1" };

describe("idempotentAdminCommand", () => {
  it("runs once and returns the first result when the same key is replayed", async () => {
    let runs = 0;
    const record = idempotentAdminCommand(
      { uow: createFakeUnitOfWork() },
      {
        commandType: "third_party_sale.record",
        run: async (_db, command: { grossPence: number }) => ({
          saleId: `sale-${++runs}`,
          grossPence: command.grossPence,
        }),
      },
    );

    const first = await record({ grossPence: 100 }, ctx);
    const second = await record({ grossPence: 100 }, ctx);

    expect(runs).toBe(1);
    expect(second).toEqual(first);
    expect(first.saleId).toBe("sale-1");
  });

  it("rejects the same key with a different body", async () => {
    const run = vi.fn(async () => ({ ok: true }));
    const record = idempotentAdminCommand(
      { uow: createFakeUnitOfWork() },
      { commandType: "third_party_sale.record", run },
    );
    await record({ grossPence: 100 }, ctx);

    await expect(record({ grossPence: 200 }, ctx)).rejects.toMatchObject({
      statusCode: 409,
      code: SHOP_API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("treats a different key as a new command", async () => {
    let runs = 0;
    const record = idempotentAdminCommand(
      { uow: createFakeUnitOfWork() },
      { commandType: "sale_fee.approve", run: async () => ({ n: ++runs }) },
    );
    await record({ feeId: "a" }, ctx);
    const second = await record({ feeId: "a" }, { ...ctx, idempotencyKey: "idem-key-0002" });
    expect(second).toEqual({ n: 2 });
  });

  it("does not record a failed command, so the retry can run", async () => {
    let attempt = 0;
    const approve = idempotentAdminCommand(
      { uow: createFakeUnitOfWork() },
      {
        commandType: "sale_fee.approve",
        run: async () => {
          attempt += 1;
          if (attempt === 1) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Not pending", 409);
          }
          return { status: "approved" };
        },
      },
    );
    await expect(approve({ feeId: "a" }, ctx)).rejects.toMatchObject({ statusCode: 409 });
    await expect(approve({ feeId: "a" }, ctx)).resolves.toEqual({ status: "approved" });
  });

  it("scopes keys by command type and by actor", async () => {
    let runs = 0;
    const uow = createFakeUnitOfWork();
    const run = async () => ({ n: ++runs });
    const approve = idempotentAdminCommand({ uow }, { commandType: "sale_fee.approve", run });
    const grant = idempotentAdminCommand({ uow }, { commandType: "sale_authority.grant", run });
    await approve({ id: "a" }, ctx);
    await grant({ id: "a" }, ctx);
    await approve({ id: "a" }, { ...ctx, actorSubjectId: "actor-2" });
    expect(runs).toBe(3);
  });
});
