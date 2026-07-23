import type { WorkerEnv } from "../../env.js";
import { getZohoCrmAccessToken } from "./oauth-token-refresh.js";
import type { ZohoUpsertRecord, ZohoUpsertResult } from "./types.js";
import { ZohoCrmHttpError } from "./types.js";

/** Upsert a CRM module row keyed by duplicate-check / external id field. */
export async function zohoCrmUpsert(
  env: WorkerEnv,
  record: ZohoUpsertRecord,
): Promise<ZohoUpsertResult> {
  const token = await getZohoCrmAccessToken(env);
  if (!token) {
    throw new ZohoCrmHttpError(503, "zoho_crm_not_configured");
  }

  const url = new URL(`/crm/v8/${record.module}/upsert`, env.ZOHO_API_HOST);
  const body = {
    data: [
      {
        ...record.fields,
        External_ID: record.externalId,
      },
    ],
    duplicate_check_fields: ["External_ID"],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ZohoCrmHttpError(res.status, text.slice(0, 4_000));
  }

  let zohoRecordId: string | undefined;
  try {
    const parsed = JSON.parse(text) as {
      data?: Array<{ details?: { id?: string }; code?: string }>;
    };
    zohoRecordId = parsed.data?.[0]?.details?.id;
  } catch {
    /* ignore parse for upsert acknowledgement */
  }

  return {
    module: record.module,
    externalId: record.externalId,
    status: res.status,
    ...(zohoRecordId ? { zohoRecordId } : {}),
  };
}
