import type { AbsenteeBidResult, AbsenteeBidWriter } from "@/lib/data/contracts";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseRefusalDetails } from "@/lib/data/http/refusal-details";
import { X_LEGAL_ENTITY_ID_HEADER } from "@auction/http-headers";

/** Leaves a maximum on a lot that has not opened yet, to be bid for the bidder from the opening. */
/** @param actingEntityId Server-resolved acting entity, sent explicitly so the maximum is left for the right account. */
export function createHttpAbsenteeBidWriter(actingEntityId?: string): AbsenteeBidWriter {
  const client = getBrowserHc();
  return {
    async schedule(input): Promise<AbsenteeBidResult> {
      const res = await client.lots[":id"]["absentee-bids"].$post({
        param: { id: input.lotId },
        json: { buyerLegalEntityId: input.buyerLegalEntityId, maxAmount: input.maxAmount },
        ...(actingEntityId ? { header: { [X_LEGAL_ENTITY_ID_HEADER]: actingEntityId } } : {}),
      });
      if (res.ok) return { ok: true };
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        details?: unknown;
      };
      const details = parseRefusalDetails(json.details);
      return {
        ok: false,
        error: json.error ?? "Could not save your maximum",
        status: res.status,
        code: json.code ?? null,
        ...(details ? { details } : {}),
      };
    },
  };
}
