import "server-only";

import type { AutoBidSettings } from "@/lib/data/contracts";
import { getServerHc } from "@/lib/data/http/hc-server";

function parseSettings(raw: unknown): AutoBidSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.maxAutoBidAmount !== "string" || typeof o.isActive !== "boolean") return null;
  return {
    maxAutoBidAmount: o.maxAutoBidAmount,
    autoBidStepAmount: o.autoBidStepAmount == null ? null : String(o.autoBidStepAmount),
    isActive: o.isActive,
  };
}

/** Authenticated buyer's active proxy settings for SSR hydration. */
export async function getServerAutoBid(lotId: string): Promise<AutoBidSettings | null> {
  const client = await getServerHc();
  const res = await client.lots[":id"]["auto-bid"].$get({ param: { id: lotId } });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { data?: unknown };
  return parseSettings(json.data);
}
