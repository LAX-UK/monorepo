import "server-only";

import type { CoverView } from "@/lib/admin/sale-cover/cover-view";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

/** The sale's cover slots, measured analysis, home settings and every home pin. */
export async function getAdminSaleCover(saleId: string): Promise<CoverView | null> {
  const res = await authedServerFetch(`/admin/sales/${encodeURIComponent(saleId)}/cover`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The cover settings could not be read (${res.status}).`);
  const body = (await res.json()) as { data?: CoverView };
  if (!body.data) throw new Error("The sale cover came back empty");
  return body.data;
}
