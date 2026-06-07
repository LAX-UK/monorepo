"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { EntityDocument } from "@auction/types";
import type { attachSubmissionDocumentBodySchema } from "@auction/validators";
import type { z } from "zod";

type AttachBody = z.infer<typeof attachSubmissionDocumentBodySchema>;

function parseDocument(raw: unknown): EntityDocument {
  return raw as EntityDocument;
}

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
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false as const, error: err?.error ?? "Could not attach document." };
    }
    const payload = (await res.json()) as { data: unknown };
    return { ok: true as const, data: parseDocument(payload.data) };
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
