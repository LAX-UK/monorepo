import type { WorkerEnv } from "../../../env.js";
import { getZohoCrmAccessToken } from "../oauth-token-refresh.js";
import type { CampaignsContactKind, CampaignsContactRow } from "./campaigns-suppression-event.js";

/**
 * Reads the Campaigns lists of unsubscribed and bounced contacts. The sync depends on this port,
 * never on Zoho's API, and it only ever reads.
 */
export interface ZohoCampaignsContactSource {
  /** One page of a list, in Zoho's own order. A page shorter than `limit` is the last one. */
  listContacts(
    kind: CampaignsContactKind,
    page: { offset: number; limit: number },
  ): Promise<CampaignsContactRow[]>;
}

/** The one HTTP call the adapter makes, so tests can stand in for Zoho. */
export type CampaignsHttpGet = (
  url: URL,
  headers: Record<string, string>,
) => Promise<{ status: number; body: unknown }>;

export const fetchCampaignsGet: CampaignsHttpGet = async (url, headers) => {
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: null };
  }
};

/**
 * EXPECTED SHAPE, NOT YET CONFIRMED against the Campaigns sandbox:
 *   GET {ZOHO_API_HOST}/api/v1.1/getlistsubscribers
 *       ?resfmt=JSON&listkey=<list>&status=<unsub|bounce>&fromindex=<1-based>&range=<n>
 *   200 { "status": "success", "list_of_details": [ { "contact_email": "...",
 *         "unsubscribed_time" | "bounced_time": "<ISO or epoch ms>", "bounce_type": "hard|soft" } ] }
 * Auth is the same OAuth refresh token the CRM sync uses, sent as `Zoho-oauthtoken`.
 * The list has no "changed since" filter, so the sync reads whole lists and filters by time.
 */
export const CAMPAIGNS_LIST_PATH = "/api/v1.1/getlistsubscribers";
const STATUS_BY_KIND: Record<CampaignsContactKind, string> = {
  unsubscribed: "unsub",
  bounced: "bounce",
};

export class HttpZohoCampaignsContactSource implements ZohoCampaignsContactSource {
  constructor(
    private readonly env: WorkerEnv,
    private readonly get: CampaignsHttpGet = fetchCampaignsGet,
    private readonly getToken: typeof getZohoCrmAccessToken = getZohoCrmAccessToken,
  ) {}

  async listContacts(
    kind: CampaignsContactKind,
    page: { offset: number; limit: number },
  ): Promise<CampaignsContactRow[]> {
    const token = await this.getToken(this.env);
    if (!token) throw new Error("zoho_campaigns_oauth_not_configured");
    if (!this.env.ZOHO_CAMPAIGNS_LIST_KEY) throw new Error("zoho_campaigns_list_key_missing");

    const url = new URL(CAMPAIGNS_LIST_PATH, this.env.ZOHO_API_HOST);
    url.searchParams.set("resfmt", "JSON");
    url.searchParams.set("listkey", this.env.ZOHO_CAMPAIGNS_LIST_KEY);
    url.searchParams.set("status", STATUS_BY_KIND[kind]);
    url.searchParams.set("fromindex", String(page.offset + 1));
    url.searchParams.set("range", String(page.limit));

    const res = await this.get(url, { Authorization: `Zoho-oauthtoken ${token}` });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`zoho_campaigns_list_failed_${res.status}`);
    }
    const body = res.body as { list_of_details?: unknown } | null;
    const rows = body?.list_of_details;
    if (rows === undefined) return [];
    if (!Array.isArray(rows)) throw new Error("zoho_campaigns_list_unexpected_shape");
    return rows.filter((r): r is CampaignsContactRow => typeof r === "object" && r !== null);
  }
}
