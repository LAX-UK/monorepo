import type { Lot } from "@auction/types";
import type { LotCreatedPayload, LotEndedPayload } from "../domain/lot-events.js";

export type RecordCreatedInput = {
  lot: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">;
  source: LotCreatedPayload["source"];
  actorUserId?: string | null;
};

export type RecordEndedInput = {
  lot: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">;
  payload: LotEndedPayload;
  actorUserId?: string | null;
};
