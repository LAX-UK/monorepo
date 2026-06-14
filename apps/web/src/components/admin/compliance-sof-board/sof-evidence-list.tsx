"use client";

import { SofDocumentThumbnail } from "@/components/admin/compliance-sof-board/sof-document-thumbnail";
import { downloadAllSofDocumentsAction, downloadSofDocumentAction } from "@/lib/actions/compliance";
import { SOF_EVIDENCE_CHECKLIST } from "@/lib/admin/sof-evidence-checklist";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
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
    <li className="rounded border border-border-hairline bg-surface-container-low px-2 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
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
      </div>
      <SofDocumentThumbnail doc={doc} downloadUrl={doc.downloadUrl} />
      {error ? (
        <span className="mt-1 block text-[11px] text-error" role="alert">
          {error}
        </span>
      ) : null}
    </li>
  );
}

function DownloadAllButton({ caseId }: { caseId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDownloadAll() {
    setError(null);
    startTransition(async () => {
      const result = await downloadAllSofDocumentsAction(caseId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={handleDownloadAll}
      >
        {pending ? "Preparing zip…" : "Download all (zip)"}
      </Button>
      {error ? (
        <span className="font-body text-xs text-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
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
        <DownloadAllButton caseId={caseId} />
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
