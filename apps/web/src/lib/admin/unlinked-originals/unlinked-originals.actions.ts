"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";

export type BlockUnlinkedPublishingResult = { ok: true } | { ok: false; error: string };

export async function setBlockUnlinkedPublishingAction(
  blockPublishing: boolean,
): Promise<BlockUnlinkedPublishingResult> {
  return instrumentServerAction("setBlockUnlinkedPublishingAction", async () => {
    const res = await authedServerFetch("/admin/inventory/unlinked-originals/block-publishing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockPublishing }),
    });
    if (res.status === 403) {
      return { ok: false, error: "Only an administrator can change this." };
    }
    if (!res.ok) return { ok: false, error: "We couldn't save this setting. Try again." };
    revalidatePath("/admin/settings/unlinked-originals");
    return { ok: true };
  });
}
