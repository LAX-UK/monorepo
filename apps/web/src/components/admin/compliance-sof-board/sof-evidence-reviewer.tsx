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
import {
  ChoiceRow,
  ConfirmActionDialog,
  Field,
  Notice,
  Section,
  StaffButton,
  StaffCheckbox,
  StatusBadge,
  TextArea,
  cn,
} from "@auction/staff-ui";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

import {
  type SofEvidenceCheckState,
  isSofEvidencePdfFileName,
  isSofEvidenceReviewDirty,
  sofEvidenceChecksFromDoc,
} from "@/lib/admin/compliance/sof-evidence-reviewer.vm";

const CHECKS = [
  ["matchesDeclaredSource", "Matches declared source"],
  ["coversExposure", "Covers exposure period and amount"],
  ["recentEnough", "Document recent enough"],
  ["legibleComplete", "Legible and complete"],
] as const;

type Doc = AdminSourceOfFundsDetail["submittedDocuments"][number];

type Props = {
  caseId: string;
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
  readOnly?: boolean;
};

export function SofEvidenceReviewer({ caseId, row, detail, readOnly = false }: Props) {
  const router = useRouter();
  const checkId = useId();
  const docs = detail.submittedDocuments;
  const [selectedId, setSelectedId] = useState<string | null>(docs[0]?.id ?? null);
  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const sufficiency = useMemo(() => summarizeEvidenceSufficiency(docs), [docs]);

  const [checks, setChecks] = useState<SofEvidenceCheckState>(() =>
    sofEvidenceChecksFromDoc(selected),
  );
  const [note, setNote] = useState(selected?.staffReview?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [downloadPending, startDownload] = useTransition();
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<Doc | null>(null);
  const dirty = isSofEvidenceReviewDirty(selected, checks, note);

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
    setChecks(sofEvidenceChecksFromDoc(doc));
    setNote(doc.staffReview?.note ?? "");
    setPreviewFailed(false);
    setError(null);
  }, [docs, selectedId, dirty]);

  function applyDoc(doc: Doc) {
    setSelectedId(doc.id);
    setChecks(sofEvidenceChecksFromDoc(doc));
    setNote(doc.staffReview?.note ?? "");
    setError(null);
    setPreviewFailed(false);
  }

  function selectDoc(doc: Doc) {
    if (doc.id === selectedId) return;
    if (dirty) {
      setPendingDoc(doc);
      setDiscardConfirmOpen(true);
      return;
    }
    applyDoc(doc);
  }

  function confirmDiscardAndSelect() {
    if (!pendingDoc) return;
    applyDoc(pendingDoc);
    setPendingDoc(null);
    setDiscardConfirmOpen(false);
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
  const showPdf = selected && isSofEvidencePdfFileName(fileName);
  const staleConflict = error != null && isSofStaleConflictMessage(error);

  if (docs.length === 0) {
    return (
      <Section title="Evidence">
        <div className="flex flex-col gap-3">
          <p className="text-staff-sm text-staff-muted">
            {detail.documentRequest.requestedAt
              ? "Awaiting buyer upload — request sent."
              : "None submitted. Use Request documents to ask the buyer."}
          </p>
          <ul className="list-inside list-disc text-staff-sm text-staff-muted">
            {SOF_EVIDENCE_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Section>
    );
  }

  const canReview = !readOnly && row.status === "pending";

  return (
    <Section title="Evidence review" description={sufficiency.summary}>
      <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
        <ul aria-label="Submitted documents" className="flex flex-col gap-1">
          {docs.map((doc) => {
            const reviewed = doc.staffReview != null;
            const current = selectedId === doc.id;
            return (
              <li key={doc.id}>
                <StaffButton
                  variant="ghost"
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "h-auto w-full flex-col items-start justify-start gap-0.5 whitespace-normal rounded-staff-md border px-3 py-2 text-left text-staff-sm",
                    current
                      ? "border-staff-ink bg-staff-hover"
                      : "border-staff-line hover:bg-staff-hover",
                  )}
                  onClick={() => selectDoc(doc)}
                >
                  <span className="font-medium text-staff-fg">{doc.requestedType}</span>
                  <span className="truncate text-staff-xs text-staff-muted">
                    {doc.fileName ?? doc.label ?? "Document"}
                  </span>
                  <span className="text-staff-xs text-staff-muted">
                    {formatDateTime(doc.uploadedAt)}
                    {reviewed ? " · Reviewed" : ""}
                  </span>
                </StaffButton>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="min-h-[16rem] rounded-staff-lg border border-staff-line bg-staff-sunken p-2">
              {previewFailed ? (
                <p className="p-4 text-staff-sm text-staff-muted">
                  Could not load the preview. Open the file in a new tab or download it.
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
                  className="h-[28rem] w-full rounded-staff-xs border-0"
                  referrerPolicy="no-referrer"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <p className="p-4 text-staff-sm text-staff-muted">
                  No preview for this file type. Download it or open it in a new tab.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {previewUrl ? (
                <StaffButton asChild size="sm" variant="secondary">
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    Open in new tab
                  </a>
                </StaffButton>
              ) : null}
              <StaffButton
                size="sm"
                variant="secondary"
                loading={downloadPending}
                onClick={downloadSelected}
              >
                Download
              </StaffButton>
            </div>

            {canReview ? (
              <div className="flex flex-col gap-3 rounded-staff-lg border border-staff-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-staff-sm font-semibold text-staff-fg">
                    Verification checklist
                  </h3>
                  {dirty ? <StatusBadge tone="warning">Unsaved changes</StatusBadge> : null}
                </div>
                {row.declaredSource ? (
                  <p className="text-staff-xs text-staff-muted">
                    Declared source: {row.declaredSource}
                  </p>
                ) : null}
                <div className="flex flex-col">
                  {CHECKS.map(([key, label]) => (
                    <ChoiceRow
                      key={key}
                      htmlFor={`${checkId}-${key}`}
                      label={label}
                      disabled={pending}
                      control={
                        <StaffCheckbox
                          id={`${checkId}-${key}`}
                          checked={checks[key]}
                          disabled={pending}
                          onCheckedChange={(v) =>
                            setChecks((prev) => ({ ...prev, [key]: v === true }))
                          }
                        />
                      }
                    />
                  ))}
                </div>
                <Field label="Reviewer notes" optional>
                  <TextArea
                    rows={3}
                    value={note}
                    disabled={pending}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
                {staleConflict ? (
                  <Notice
                    tone="warning"
                    title="Case changed"
                    actions={
                      <StaffButton size="sm" variant="secondary" onClick={() => router.refresh()}>
                        Reload case
                      </StaffButton>
                    }
                  >
                    {SOF_STALE_RELOAD_MESSAGE}
                  </Notice>
                ) : error ? (
                  <Notice tone="danger" alert title="The review was not saved">
                    {error}
                  </Notice>
                ) : null}
                <div>
                  <StaffButton variant="primary" loading={pending} onClick={saveReview}>
                    Save review
                  </StaffButton>
                </div>
              </div>
            ) : selected.staffReview ? (
              <Notice tone="info" title="Staff review recorded">
                By {selected.staffReview.reviewedBy.label ?? "a staff member"} ·{" "}
                {formatDateTime(selected.staffReview.reviewedAt)}
                {selected.staffReview.note ? (
                  <span className="mt-1 block whitespace-pre-wrap">
                    {selected.staffReview.note}
                  </span>
                ) : null}
              </Notice>
            ) : null}
          </div>
        ) : null}
      </div>
      <ConfirmActionDialog
        open={discardConfirmOpen}
        onOpenChange={(open) => {
          setDiscardConfirmOpen(open);
          if (!open) setPendingDoc(null);
        }}
        title="Discard unsaved review changes?"
        description="Your checklist and notes for this document have not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={confirmDiscardAndSelect}
      />
    </Section>
  );
}
