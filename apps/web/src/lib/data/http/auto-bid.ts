import type {
  AutoBidMutationResult,
  AutoBidSettings,
  AutoBidWriter,
  PlaceBidResult,
} from "@/lib/data/contracts";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { notifyAdminCannotBuyIfNeeded } from "@/lib/ui/admin-cannot-buy";

function parseSettings(raw: unknown): AutoBidSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.maxAutoBidAmount === "string" && typeof o.isActive === "boolean") {
    return {
      maxAutoBidAmount: o.maxAutoBidAmount,
      autoBidStepAmount: o.autoBidStepAmount == null ? null : String(o.autoBidStepAmount),
      isActive: o.isActive,
    };
  }

  // Opening-bid path returns a Bid row instead of settings.
  if (typeof o.id === "string" && o.maxAutoBidAmount != null && o.maxAutoBidAmount !== "") {
    return {
      maxAutoBidAmount: String(o.maxAutoBidAmount),
      autoBidStepAmount: o.autoBidStepAmount == null ? null : String(o.autoBidStepAmount),
      isActive: true,
    };
  }

  return null;
}

export function createHttpAutoBidWriter(): AutoBidWriter {
  const client = getBrowserHc();
  return {
    async getAutoBid(lotId: string): Promise<AutoBidSettings | null> {
      const res = await client.lots[":id"]["auto-bid"].$get({ param: { id: lotId } });
      const json = (await res.json().catch(() => ({}))) as { data?: unknown };
      if (!res.ok) return null;
      return parseSettings(json.data);
    },
    async setAutoBid(input): Promise<AutoBidMutationResult> {
      const res = await client.lots[":id"]["auto-bid"].$put({
        param: { id: input.lotId },
        json: {
          maxAutoBidAmount: input.maxAutoBidAmount,
          autoBidStepAmount: input.autoBidStepAmount,
        },
        ...(input.idempotencyKey ? { header: { "Idempotency-Key": input.idempotencyKey } } : {}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
        code?: string;
        summary?: {
          feedback?: PlaceBidResult extends { ok: false } ? PlaceBidResult["kycFeedback"] : never;
        };
      };
      if (!res.ok) {
        notifyAdminCannotBuyIfNeeded(json.error, res.status);
        return {
          ok: false,
          error: json.error ?? "Could not save auto-bid",
          status: res.status,
          code: json.code ?? null,
          ...(json.summary?.feedback ? { kycFeedback: json.summary.feedback } : {}),
        };
      }
      const settings = parseSettings(json.data);
      if (!settings) {
        return { ok: false, error: "Invalid response", status: res.status };
      }
      return { ok: true, settings };
    },
    async clearAutoBid(lotId: string) {
      const res = await client.lots[":id"]["auto-bid"].$delete({ param: { id: lotId } });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        return { ok: false, error: json.error ?? "Could not clear auto-bid", status: res.status };
      }
      return { ok: true };
    },
  };
}
