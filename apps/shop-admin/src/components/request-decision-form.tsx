"use client";

import { decideSaleAuthorityRequest } from "@/server/application/admin-people-actions.server";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RequestDecisionForm({
  requestId,
  requestedCount,
}: {
  requestId: string;
  requestedCount: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [authorisedCount, setAuthorisedCount] = useState(requestedCount);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  async function run(decision: "approve" | "decline") {
    if (decision === "approve") {
      if (!Number.isInteger(authorisedCount) || authorisedCount < 0 || authorisedCount > 10) {
        setMessage("Authorised count must be a whole number from 0 to 10.");
        return;
      }
      if (!evidenceNote.trim()) {
        setMessage("Evidence note is required to approve.");
        return;
      }
    } else if (!declineReason.trim()) {
      setMessage("Decline reason is required.");
      return;
    }

    setPending(true);
    setMessage(null);
    const result = await decideSaleAuthorityRequest({
      requestId,
      decision,
      idempotencyKey,
      ...(decision === "approve"
        ? { authorisedCount, evidenceNote: evidenceNote.trim() }
        : { declineReason: declineReason.trim() }),
    });
    setPending(false);
    if (!result.ok) {
      if (result.kind === "step_up_required") {
        setMessage(result.message);
      } else if ("message" in result) {
        setMessage(result.message);
      } else {
        setMessage("Action failed.");
      }
      return;
    }
    setIdempotencyKey(crypto.randomUUID());
    setMessage(decision === "approve" ? "Approved." : "Declined.");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-neutral-600">Authorised count (0–10)</span>
          <input
            type="number"
            min={0}
            max={10}
            value={authorisedCount}
            disabled={pending}
            className="mt-1 w-full rounded border px-2 py-1"
            onChange={(event) => setAuthorisedCount(Number(event.target.value))}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-neutral-600">Evidence note (required to approve)</span>
          <textarea
            value={evidenceNote}
            disabled={pending}
            rows={2}
            className="mt-1 w-full rounded border px-2 py-1"
            onChange={(event) => setEvidenceNote(event.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-neutral-600">Decline reason (required to decline)</span>
          <textarea
            value={declineReason}
            disabled={pending}
            rows={2}
            className="mt-1 w-full rounded border px-2 py-1"
            onChange={(event) => setDeclineReason(event.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded border px-2 py-1 text-sm"
          onClick={() => void run("approve")}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border px-2 py-1 text-sm"
          onClick={() => void run("decline")}
        >
          Decline
        </button>
        {message ? <span className="text-sm text-neutral-600">{message}</span> : null}
      </div>
    </div>
  );
}
