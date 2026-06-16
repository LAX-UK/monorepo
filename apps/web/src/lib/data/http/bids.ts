import type { BidWriter, PlaceBidInput, PlaceBidResult } from "@/lib/data/contracts";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseBid } from "@/lib/data/http/parse";
import { clearClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import { notifyAdminCannotBuyIfNeeded } from "@/lib/ui/admin-cannot-buy";
import { X_LEGAL_ENTITY_ID_HEADER } from "@auction/http-headers";

/** @param actingEntityId Server-resolved (membership-validated) acting entity.
 * Sent explicitly so the bid never relies on a possibly-stale browser cookie. */
export function createHttpBidWriter(actingEntityId?: string): BidWriter {
  const client = getBrowserHc();
  return {
    async placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
      const header: Record<string, string> = {};
      if (input.idempotencyKey) header["Idempotency-Key"] = input.idempotencyKey;
      if (actingEntityId) header[X_LEGAL_ENTITY_ID_HEADER] = actingEntityId;
      const res = await client.bids.$post({
        json: {
          lotId: input.lotId,
          amount: input.amount,
          ...(input.maxAutoBidAmount !== undefined
            ? { maxAutoBidAmount: input.maxAutoBidAmount }
            : {}),
          ...(input.autoBidStepAmount !== undefined
            ? { autoBidStepAmount: input.autoBidStepAmount }
            : {}),
        },
        ...(Object.keys(header).length > 0 ? { header } : {}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
        code?: string;
        summary?: {
          feedback?: {
            headline: string;
            detail: string | null;
            needsResubmit: boolean;
            action: "start" | "continue" | "retry" | "wait" | "none";
          };
        };
      };
      if (!res.ok) {
        const errMsg = json.error ?? "Could not place bid";
        notifyAdminCannotBuyIfNeeded(json.error, res.status);
        // Self-heal a stale acting-entity cookie: the bid was sent on behalf of
        // a legal entity the user is no longer (or never was) a member of. Drop
        // the cookie so the next attempt falls back to the personal profile.
        if (
          res.status === 403 &&
          (json.error === "not_a_member_of_legal_entity" ||
            json.code === "not_a_member_of_legal_entity")
        ) {
          clearClientActingLegalEntityId();
        }
        return {
          ok: false,
          error: errMsg,
          status: res.status,
          code: json.code ?? null,
          kycFeedback: json.summary?.feedback ?? null,
        };
      }
      if (!json.data) {
        return { ok: false, error: "Invalid response", status: res.status };
      }
      return { ok: true, bid: parseBid(json.data) };
    },
  };
}
