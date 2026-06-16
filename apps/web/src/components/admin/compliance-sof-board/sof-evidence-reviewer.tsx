"use client";

import { downloadSofDocumentAction, reviewSofDocumentAction } from "@/lib/actions/compliance";
import {
  SOF_STALE_RELOAD_MESSAGE,
  isSofStaleConflictMessage,
} from "@/lib/admin/compliance-error-messages";
import { SOF_EVIDENCE_CHECKLIST } from "@/lib/admin/sof-evidence-checklist";
import { apiBaseUrl } from "@/lib/auth/api-base";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { summarizeEvidenceSufficiency } from "@/lib/data/view-models/admin-sof-timeline.vm";
import { formatDateTime } from "@/lib/ui/format";
import { isImageFileName } from "@/lib/upload-limits";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Textarea } from "@auction/ui/components/textarea";
import { cn } from "@auction/ui/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type Doc = AdminSourceOfFundsDetail["submittedDocuments"][number];

type CheckState = {
  matchesDeclaredSource: boolean;
  coversExposure: boolean;
  recentEnough: boolean;
  legibleComplete: boolean;
};

type Props = {
  caseId: string;
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
  readOnly?: boolean;
};

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function checksFromDoc(doc: Doc | null): CheckState {
  return {
    matchesDeclaredSource: Boolean(doc?.staffReview?.checks.matchesDeclaredSource),
    coversExposure: Boolean(doc?.staffReview?.checks.coversExposure),
    recentEnough: Boolean(doc?.staffReview?.checks.recentEnough),
    legibleComplete: Boolean(doc?.staffReview?.checks.legibleComplete),
  };
}

function isReviewDirty(doc: Doc | null, checks: CheckState, note: string): boolean {
  if (!doc) return false;
  const saved = checksFromDoc(doc);
  const savedNote = doc.staffReview?.note ?? "";
  return (
    checks.matchesDeclaredSource !== saved.matchesDeclaredSource ||
    checks.coversExposure !== saved.coversExposure ||
    checks.recentEnough !== saved.recentEnough ||
    checks.legibleComplete !== saved.legibleComplete ||
    note !== savedNote
  );
}

export function SofEvidenceReviewer({ caseId, row, detail, readOnly = false }: Props) {
  const router = useRouter();
  const docs = detail.submittedDocuments;
  const [selectedId, setSelectedId] = useState<string | null>(docs[0]?.id ?? null);
  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const sufficiency = useMemo(() => summarizeEvidenceSufficiency(docs), [docs]);

  const [checks, setChecks] = useState<CheckState>(() => checksFromDoc(selected));
  const [note, setNote] = useState(selected?.staffReview?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [downloadPending, startDownload] = useTransition();
  const dirty = isReviewDirty(selected, checks, note);

  useEffect(() => {
    if (docs.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId == null || !docs.some((d) => d.id === selectedId)) {
      setSelectedId(docs[0]?.id ?? null);
    }
  }, [docs, selectedId]);

  useEffect(() => {
    const doc = docs.find((d) => d.id === selectedId) ?? null;
    if (!doc) return;
    if (dirty) return;
    setChecks(checksFromDoc(doc));
    setNote(doc.staffReview?.note ?? "");
    setPreviewFailed(false);
    setError(null);
  }, [docs, selectedId, dirty]);

  function applyDoc(doc: Doc) {
    setSelectedId(doc.id);
    setChecks(checksFromDoc(doc));
    setNote(doc.staffReview?.note ?? "");
    setError(null);
    setPreviewFailed(false);
  }

  function selectDoc(doc: Doc) {
    if (doc.id === selectedId) return;
    if (dirty && !window.confirm("Discard unsaved review changes for this document?")) return;
    applyDoc(doc);
  }

  function saveReview() {
    if (!selected || readOnly || row.status !== "pending") return;
    setError(null);
    startTransition(async () => {
      const result = await reviewSofDocumentAction(caseId, selected.id, checks, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function downloadSelected() {
    if (!selected) return;
    startDownload(async () => {
      const result = await downloadSofDocumentAction(caseId, selected.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  const previewUrl = selected
    ? `${apiBaseUrl()}/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(selected.id)}/preview`
    : null;
  const fileName = selected?.fileName ?? selected?.label ?? "";
  const showImage = selected && isImageFileName(fileName);
  const showPdf = selected && isPdfFileName(fileName);
  const staleConflict = error != null && isSofStaleConflictMessage(error);

  if (docs.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Evidence</h2>
        <p className="font-body text-sm text-on-surface-variant">
          {detail.documentRequest.requestedAt
            ? "Awaiting buyer upload — request sent"
            : "None submitted — use Request documents in the action panel"}
        </p>
        <ul className="list-inside list-disc font-body text-sm text-on-surface-variant">
          {SOF_EVIDENCE_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Evidence review</h2>
        <p className="text-xs text-on-surface-variant">{sufficiency.summary}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
        <ul className="space-y-1 rounded-lg border border-outline-variant/40 p-2">
          {docs.map((doc) => {
            const reviewed = doc.staffReview != null;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left text-sm transition-colors",
                    selectedId === doc.id
                      ? "bg-primary/10 text-on-surface"
                      : "hover:bg-surface-container-low",
                  )}
                  onClick={() => selectDoc(doc)}
                >
                  <span className="block font-medium">{doc.requestedType}</span>
                  <span className="block truncate text-xs text-on-surface-variant">
                    {doc.fileName ?? doc.label ?? "Document"}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {formatDateTime(doc.uploadedAt)}
                    {reviewed ? " · Reviewed" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <div className="space-y-4">
            <div className="min-h-[16rem] rounded-lg border border-outline-variant/40 bg-surface-container-low/30 p-2">
              {previewFailed ? (
                <p className="p-4 text-sm text-on-surface-variant">
                  Couldn&apos;t load preview. Open in a new tab or download the file.
                </p>
              ) : showImage && previewUrl ? (
                <div className="relative mx-auto aspect-[4/3] max-h-[28rem] w-full">
                  <Image
                    src={previewUrl}
                    alt={fileName || selected.requestedType}
                    fill
                    unoptimized
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    onError={() => setPreviewFailed(true)}
                  />
                </div>
              ) : showPdf && previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={fileName || selected.requestedType}
                  className="h-[28rem] w-full rounded border-0"
                  referrerPolicy="no-referrer"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <p className="p-4 text-sm text-on-surface-variant">
                  Preview not available for this file type. Use download or open in new tab.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {previewUrl ? (
                <Button type="button" size="sm" variant="outline" asChild>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    Open in new tab
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={downloadPending}
                onClick={downloadSelected}
              >
                {downloadPending ? "Preparing…" : "Download"}
              </Button>
            </div>

            {!readOnly && row.status === "pending" ? (
              <div className="space-y-3 rounded-lg border border-outline-variant/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-label text-[10px] uppercase text-on-surface-variant">
                    Verification checklist
                  </p>
                  {dirty ? (
                    <span className="text-[10px] font-medium uppercase text-warning">Unsaved</span>
                  ) : null}
                </div>
                {row.declaredSource ? (
                  <p className="text-xs text-on-surface-variant">
                    Declared source: {row.declaredSource}
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {(
                    [
                      ["matchesDeclaredSource", "Matches declared source"],
                      ["coversExposure", "Covers exposure period/amount"],
                      ["recentEnough", "Document recent enough"],
                      ["legibleComplete", "Legible and complete"],
                    ] as const
                  ).map(([key, label]) => (
                    <li key={key}>
                      <div className="flex items-start gap-2 text-sm">
                        <Checkbox
                          className="mt-0.5"
                          checked={checks[key]}
                          disabled={pending}
                          aria-label={label}
                          onCheckedChange={(v) =>
                            setChecks((prev) => ({ ...prev, [key]: v === true }))
                          }
                        />
                        <span>{label}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <Textarea
                  rows={3}
                  className="text-sm"
                  placeholder="Reviewer notes (optional)"
                  value={note}
                  disabled={pending}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button type="button" size="sm" disabled={pending} onClick={saveReview}>
                  {pending ? "Saving…" : "Save review"}
                </Button>
                {staleConflict ? (
                  <Alert>
                    <AlertTitle>Case changed</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{SOF_STALE_RELOAD_MESSAGE}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => router.refresh()}
                      >
                        Reload case
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : error ? (
                  <p className="text-xs text-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : selected.staffReview ? (
              <Alert>
                <AlertTitle>Staff review recorded</AlertTitle>
                <AlertDescription className="space-y-1 text-sm">
                  <p>
                    By {selected.staffReview.reviewedBy.label ?? selected.staffReview.reviewedBy.id}{" "}
                    · {formatDateTime(selected.staffReview.reviewedAt)}
                  </p>
                  {selected.staffReview.note ? (
                    <p className="whitespace-pre-wrap">{selected.staffReview.note}</p>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
