"use client";

import { downloadSofDocumentAction } from "@/lib/actions/compliance";
import { SOF_EVIDENCE_CHECKLIST } from "@/lib/admin/sof-evidence-checklist";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import { formatDateTime } from "@/lib/ui/format";
import { useState, useTransition } from "react";

type Props = {
  detail: AdminSourceOfFundsDetail | null;
  evidenceCount: number;
};

/** Renders one buyer-submitted SoF document with an audited, short-TTL download.
 * Clicking fetches a fresh presigned URL via the server action (which records a
 * `document_downloaded` audit event) and opens it in a new tab. */
function SubmittedDocumentRow({
  caseId,
  doc,
}: {
  caseId: string;
  doc: AdminSourceOfFundsDetail["submittedDocuments"][number];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const result = await downloadSofDocumentAction(caseId, doc.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded border border-border-hairline bg-surface-container-low px-2 py-1 text-sm">
      <span className="min-w-0 flex-1 truncate font-medium">
        {doc.fileName ?? doc.requestedType}
      </span>
      <span className="shrink-0 font-label text-[9px] uppercase tracking-wide text-on-surface-variant">
        {doc.reviewStatus}
      </span>
      <button
        type="button"
        onClick={handleDownload}
        disabled={pending}
        className="shrink-0 text-link underline disabled:opacity-60"
      >
        {pending ? "Preparing…" : "Download"}
      </button>
      {error ? (
        <span className="w-full text-[11px] text-error" role="alert">
          {error}
        </span>
      ) : null}
    </li>
  );
}

export function SofEvidenceList({ detail, evidenceCount }: Props) {
  const legacyDownloads = detail?.evidenceDownloads ?? [];
  const submitted = detail?.submittedDocuments ?? [];
  const request = detail?.documentRequest;
  const caseId = detail?.case.id ?? null;

  if (submitted.length > 0 && caseId) {
    return (
      <div className="space-y-3">
        {request?.submittedAt ? (
          <p className="font-body text-xs text-on-surface-variant">
            Buyer submitted {formatDateTime(request.submittedAt)}
          </p>
        ) : null}
        <ul className="mt-1 space-y-1">
          {submitted.map((file) => (
            <SubmittedDocumentRow key={file.id} caseId={caseId} doc={file} />
          ))}
        </ul>
      </div>
    );
  }

  if (legacyDownloads.length === 0 && evidenceCount === 0) {
    return (
      <div className="space-y-2">
        <p className="font-body text-sm text-on-surface-variant">
          {request?.requestedAt
            ? "Awaiting buyer upload — request sent"
            : "None submitted — use Request documents below"}
        </p>
        <div>
          <p className="font-label text-[10px] uppercase text-on-surface-variant">
            Suggested document types
          </p>
          <ul className="mt-1 list-inside list-disc font-body text-sm text-on-surface-variant">
            {SOF_EVIDENCE_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (legacyDownloads.length === 0) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        {evidenceCount} legacy file{evidenceCount === 1 ? "" : "s"} — reload detail to fetch links.
      </p>
    );
  }

  return (
    <ul className="mt-1 space-y-1">
      {legacyDownloads.map((file) => (
        <li
          key={file.key}
          className="flex items-center gap-2 rounded border border-border-hairline bg-surface-container-low px-2 py-1 text-sm"
        >
          {file.downloadUrl ? (
            <a
              href={file.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-link underline"
              title={file.key}
            >
              {file.fileName}
            </a>
          ) : (
            <span className="truncate text-on-surface-variant" title={file.key}>
              {file.fileName}
            </span>
          )}
          <span className="shrink-0 font-label text-[9px] uppercase tracking-wide text-secondary">
            {file.downloadUrl ? "Download" : "Unavailable"}
          </span>
        </li>
      ))}
    </ul>
  );
}
