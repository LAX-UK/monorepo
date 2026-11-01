import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { zTransformParse } from "@/lib/data/http/schema-coerce";
import type {
  DisputeDeskCase,
  DisputeDeskCaseSummary,
  DisputeDeskCounts,
  DisputeDeskPage,
  DisputeDeskView,
} from "@auction/types";

export type DisputeDeskPageParams = {
  view: DisputeDeskView;
  q?: string | undefined;
  reason?: string | undefined;
  limit: number;
  offset: number;
};

/** One page of dispute cases for a view, with the count of every view. */
export async function getDisputeDeskPage(params: DisputeDeskPageParams): Promise<DisputeDeskPage> {
  const query = new URLSearchParams({
    view: params.view,
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.q) query.set("q", params.q);
  if (params.reason) query.set("reason", params.reason);
  const res = await authedServerFetch(`/admin/finance/dispute-cases?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to load dispute cases: ${res.status}`);
  const body = (await readJsonBody(res)) as {
    data: DisputeDeskCaseSummary[];
    hasNextPage?: boolean;
    counts: DisputeDeskCounts;
  };
  return { rows: body.data, hasNextPage: Boolean(body.hasNextPage), counts: body.counts };
}

/** The API's own answer, shaped by `DisputeDeskCase`; a body that is not an object is refused. */
function parseDisputeDeskCase(value: unknown): DisputeDeskCase {
  if (typeof value !== "object" || value === null) {
    throw new Error("GET /admin/finance/dispute-cases/:id: invalid response shape");
  }
  return value as DisputeDeskCase;
}

const caseEnvelope = zTransformParse(parseDisputeDeskCase);

/** One dispute case, or null when there is no such case. */
export async function getDisputeDeskCase(caseId: string): Promise<DisputeDeskCase | null> {
  const res = await authedServerFetch(`/admin/finance/dispute-cases/${encodeURIComponent(caseId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load dispute case: ${res.status}`);
  return readDataEnvelope(
    await readJsonBody(res),
    caseEnvelope,
    "GET /admin/finance/dispute-cases/:id",
  );
}
