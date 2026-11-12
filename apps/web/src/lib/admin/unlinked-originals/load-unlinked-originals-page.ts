import "server-only";

import {
  type UnlinkedOriginalsView,
  getServerUnlinkedOriginals,
} from "@/lib/data/http/unlinked-originals.server";

export type UnlinkedOriginalsPageData = { view: UnlinkedOriginalsView | null };

export async function loadUnlinkedOriginalsPage(): Promise<UnlinkedOriginalsPageData> {
  return { view: await getServerUnlinkedOriginals() };
}
