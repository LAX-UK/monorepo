import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { ShopTransactionEffects } from "../ports/shop-unit-of-work.js";
import { hashAdminRequest } from "./hash-request.js";

export async function withAdminIdempotency<T>(input: {
  tx: ShopTransactionEffects;
  commandType: string;
  idempotencyKey: string;
  actorSubjectId: string;
  requestPayload: unknown;
  run: () => Promise<T>;
}): Promise<T> {
  const requestHash = hashAdminRequest(input.requestPayload);
  const begin = await input.tx.commands.begin({
    commandType: input.commandType,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    actorSubjectId: input.actorSubjectId,
  });
  if (begin.kind === "replay") {
    return begin.result as T;
  }
  if (begin.kind === "conflict") {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Command already in flight or idempotency key conflict",
      409,
    );
  }
  const result = await input.run();
  await input.tx.commands.complete({
    commandType: input.commandType,
    actorSubjectId: input.actorSubjectId,
    idempotencyKey: input.idempotencyKey,
    result,
  });
  return result;
}
