import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, safeReadData } from "@/lib/data/http/envelope";
import {
  purchaseProblemAssigneesSchema,
  purchaseProblemListPageSchema,
  purchaseProblemViewSchema,
} from "./admin-purchase-problems.schema";
import type {
  PurchaseProblemAssignee,
  PurchaseProblemListPage,
  PurchaseProblemView,
} from "./admin-purchase-problems.schema";

/** One page of the Purchase problems list; throws when the Bid API does not answer. */
export async function getAdminPurchaseProblems(
  query: URLSearchParams,
): Promise<PurchaseProblemListPage> {
  const res = await authedServerFetch(`/admin/purchase-problems?${query.toString()}`);
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error(`Purchase problems unavailable: ${res.status}`);
  return readDataEnvelope(
    await readJsonBody(res),
    purchaseProblemListPageSchema,
    "GET /admin/purchase-problems",
  );
}

/** One report by id; null when there is none. */
export async function getAdminPurchaseProblem(id: string): Promise<PurchaseProblemView | null> {
  const res = await authedServerFetch(`/admin/purchase-problems/${encodeURIComponent(id)}`);
  return safeReadData(res, purchaseProblemViewSchema, {
    context: "GET /admin/purchase-problems/:id",
    nullStatuses: [404],
    notOkMessage: (status) =>
      status === 403 ? "forbidden" : `Purchase problem unavailable: ${status}`,
  });
}

/** The staff a report may be given to. Empty when the Bid API does not answer. */
export async function getPurchaseProblemAssignees(): Promise<PurchaseProblemAssignee[]> {
  const res = await authedServerFetch("/admin/purchase-problem-assignees").catch(() => null);
  if (!res?.ok) return [];
  return readDataEnvelope(
    await readJsonBody(res),
    purchaseProblemAssigneesSchema,
    "GET /admin/purchase-problem-assignees",
  ).assignees;
}
