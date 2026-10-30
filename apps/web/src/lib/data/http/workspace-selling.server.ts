import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import {
  type PayoutDetail,
  type ReturnedWork,
  type SoldLot,
  payoutDetailSchema,
  returnedWorkSchema,
  soldLotSchema,
} from "@/lib/data/http/workspace-selling.schema";
import { z } from "zod";

/**
 * The acting account's selling reads (`/legal-entities/…`): sold lots with where their money
 * stands, one payout's lines, and the works that came back unsold. The API narrows each by the
 * member's role, so a refusal is an answer, not a fault.
 */

const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.object({ items: z.array(item), nextOffset: z.number().nullable() }) });

/** The API's pages are capped at this many rows. */
const PAGE_SIZE = 100;
/** Enough pages for any account's selling history on one screen. */
const MAX_PAGES = 5;

async function readPages<T extends z.ZodTypeAny>(
  path: string,
  item: T,
  params: Record<string, string> = {},
): Promise<{ items: z.infer<T>[]; complete: boolean }> {
  const items: z.infer<T>[] = [];
  let offset: number | null = 0;
  for (let read = 0; read < MAX_PAGES && offset !== null; read += 1) {
    const query = new URLSearchParams({ ...params, limit: String(PAGE_SIZE), offset: `${offset}` });
    const res = await authedServerFetch(`${path}?${query}`);
    await throwIfNotOk(res, "sellerPayouts");
    const body = page(item).parse(await readJsonBody(res));
    items.push(...body.data.items);
    offset = body.data.nextOffset;
  }
  return { items, complete: offset === null };
}

/** Every lot sold for the acting account, newest first. */
export function listServerSoldLots(): Promise<{ items: SoldLot[]; complete: boolean }> {
  return readPages("/legal-entities/sold", soldLotSchema);
}

/** One of the account's payouts with its lines; `null` when it is not the account's. */
export async function getServerPayoutDetail(payoutId: string): Promise<PayoutDetail | null> {
  const res = await authedServerFetch(
    `/legal-entities/payouts/${encodeURIComponent(payoutId)}/lines`,
  );
  if (res.status === 404) return null;
  await throwIfNotOk(res, "sellerPayouts");
  return z.object({ data: payoutDetailSchema }).parse(await readJsonBody(res)).data;
}

/** Works that came back unsold, for the collection. */
export async function listServerReturnedWorks(): Promise<ReturnedWork[]> {
  return (await readPages("/legal-entities/collection/returned", returnedWorkSchema)).items;
}

/** The sold lots as the API's CSV, passed through as it comes. */
export function fetchServerSoldCsv(year: number | null): Promise<Response> {
  const query = year ? `?year=${year}` : "";
  return authedServerFetch(`/legal-entities/sold/export.csv${query}`);
}

/** A consignment's agreement as a PDF, passed through as it comes. */
export function fetchServerAgreementPdf(submissionId: string): Promise<Response> {
  return authedServerFetch(
    `/legal-entities/consignments/${encodeURIComponent(submissionId)}/agreement.pdf`,
  );
}
