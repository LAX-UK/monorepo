"use server";

import { getWriteContainer } from "@/lib/data/write-container.server";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { AttachBuyerSofDocumentBody } from "@/lib/services/interfaces/buyer-sof-service";

export async function attachBuyerSofDocumentAction(
  caseId: string,
  body: AttachBuyerSofDocumentBody,
): Promise<void> {
  return instrumentServerAction("attachBuyerSofDocumentAction", async () => {
    const { buyerSof } = getWriteContainer();
    const r = await buyerSof.attachDocument(caseId, body);
    if (!r.ok) {
      throw new Error(r.message || "Upload failed");
    }
  });
}

export async function submitBuyerSofDocumentsAction(caseId: string): Promise<void> {
  return instrumentServerAction("submitBuyerSofDocumentsAction", async () => {
    const { buyerSof } = getWriteContainer();
    const r = await buyerSof.submitDocuments(caseId);
    if (!r.ok) {
      throw new Error(r.message || "Submit failed");
    }
  });
}
