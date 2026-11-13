import "server-only";

import { ADMIN_SERVER_ERROR_MESSAGE } from "@/lib/admin/admin-route-error-message";
import {
  type UnlinkedOriginalsView,
  getServerUnlinkedOriginals,
} from "@/lib/data/http/unlinked-originals.server";

/** LAX Bid did not answer at all: the request failed or timed out. */
export const UNLINKED_ORIGINALS_UNREACHABLE_MESSAGE =
  "LAX Bid did not answer. Try again in a moment.";

export type UnlinkedOriginalsPageData =
  | { view: UnlinkedOriginalsView; loadError: null }
  | { view: null; loadError: string };

/** The report, or what to tell staff when it could not load: no answer, or an error from LAX Bid. */
export async function loadUnlinkedOriginalsPage(): Promise<UnlinkedOriginalsPageData> {
  const load = await getServerUnlinkedOriginals();
  if (load.ok) return { view: load.view, loadError: null };
  return {
    view: null,
    loadError:
      load.reason === "unreachable"
        ? UNLINKED_ORIGINALS_UNREACHABLE_MESSAGE
        : ADMIN_SERVER_ERROR_MESSAGE,
  };
}
