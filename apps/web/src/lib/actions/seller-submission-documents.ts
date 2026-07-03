"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { entityDocumentSchema } from "@/lib/data/http/document.schema";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { attachSubmissionDocumentBodySchema } from "@auction/validators";
import type { z } from "zod";

type AttachBody = z.infer<typeof attachSubmissionDocumentBodySchema>;

export async function sellerAttachSubmissionDocumentResultAction(
  submissionId: string,
  body: AttachBody,
) {
  return instrumentServerAction("sellerAttachSubmissionDocumentResultAction", async () => {
    const res = await authedServerFetch(
      `/submissions/${encodeURIComponent(submissionId)}/documents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = await readJsonBody(res);
    if (!res.ok) {
      const err = payload as { error?: string } | null;
      return { ok: false as const, error: err?.error ?? "Could not attach document." };
    }
    return {
      ok: true as const,
      data: readDataEnvelope(
        payload,
        entityDocumentSchema,
        `POST /submissions/${submissionId}/documents`,
      ),
    };
  });
}

export async function sellerRemoveSubmissionDocumentResultAction(
  submissionId: string,
  documentId: string,
) {
  return instrumentServerAction("sellerRemoveSubmissionDocumentResultAction", async () => {
    const res = await authedServerFetch(
      `/submissions/${encodeURIComponent(submissionId)}/documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      return { ok: false as const, error: "Could not remove document." };
    }
    return { ok: true as const, data: undefined };
  });
}
