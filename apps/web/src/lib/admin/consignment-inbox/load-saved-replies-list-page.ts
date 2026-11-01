import "server-only";

import { fetchSavedReplies } from "@/lib/data/http/consignment-inbox.server";
import type { SavedReplyView } from "@auction/validators";

export type SavedRepliesPageModel = { replies: SavedReplyView[]; loadError: string | null };

/** Data/composition boundary for `/admin/inbox/saved-replies`. */
export async function loadAdminSavedRepliesListPage(): Promise<SavedRepliesPageModel> {
  const result = await fetchSavedReplies();
  return result.ok
    ? { replies: result.data, loadError: null }
    : { replies: [], loadError: "Saved replies could not load. Nothing was lost." };
}
