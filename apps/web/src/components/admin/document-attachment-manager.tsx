"use client";

import { DocumentUploadField } from "@/components/forms/document-upload-field";
import type { DocumentUploadKind } from "@/components/forms/document-upload-field";
import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { DOCUMENT_UPLOAD_HELPER, documentKindLabel } from "@/lib/admin/document-kind-labels";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import type { DocumentEntityKind, EntityDocument } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function uploadKindForEntity(entityKind: DocumentEntityKind): DocumentUploadKind {
  switch (entityKind) {
    case "lot":
      return "lot_document";
    case "sale":
      return "sale_document";
    case "submission":
      return "submission_document";
  }
}

export type DocumentAttachmentManagerProps<TKind extends string> = {
  entityKind: DocumentEntityKind;
  entityId: string;
  kinds: readonly TKind[];
  initialDocuments: EntityDocument[];
  actions: {
    attach: (input: {
      uploadObjectId: string;
      kind: TKind;
      label: string | null;
    }) => Promise<ActionResult<EntityDocument>>;
    remove: (documentId: string) => Promise<ActionResult<void>>;
  };
};

export function DocumentAttachmentManager<TKind extends string>({
  entityKind,
  entityId,
  kinds,
  initialDocuments,
  actions,
}: DocumentAttachmentManagerProps<TKind>) {
  const { uploadFile } = useUploadObjectLifecycle();
  const [documents, setDocuments] = useState<EntityDocument[]>(initialDocuments);
  const [kind, setKind] = useState<TKind>(kinds[0] as TKind);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);

  const kindRef = useRef(kind);
  const labelRef = useRef(label);
  kindRef.current = kind;
  labelRef.current = label;

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const uploadKind = useMemo(() => uploadKindForEntity(entityKind), [entityKind]);

  const addDocument = useCallback(
    async (file: File) => {
      setBusy(true);
      setErrorMessage(null);
      setRetryFile(null);
      setStatusMessage(`Uploading ${file.name}…`);
      try {
        const uploaded = await uploadFile(file, uploadKind);
        setStatusMessage(`Saving ${file.name}…`);
        const res = await actions.attach({
          uploadObjectId: uploaded.uploadObjectId,
          kind: kindRef.current,
          label: labelRef.current.trim() === "" ? null : labelRef.current.trim(),
        });
        if (!res.ok) {
          throw new Error(res.error ?? "Could not save document");
        }
        if (res.data === undefined) {
          throw new Error("Invalid server response");
        }
        const created = res.data;
        setDocuments((prev) => [...prev, created]);
        setLabel("");
        notify.success("Document added");
        setStatusMessage(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not add document";
        setErrorMessage(message);
        setRetryFile(file);
        setStatusMessage(null);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [actions, uploadFile, uploadKind],
  );

  const onFileSelected = useCallback(
    async (file: File) => {
      await addDocument(file);
    },
    [addDocument],
  );

  async function retryLastUpload() {
    if (!retryFile) return;
    try {
      await addDocument(retryFile);
    } catch {
      // Error surfaced via errorMessage state
    }
  }

  async function remove(documentId: string) {
    setBusy(true);
    const res = await actions.remove(documentId);
    setBusy(false);
    if (!res.ok) {
      notify.error("Remove failed", { description: res.error });
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    notify.success("Document removed");
  }

  return (
    <div className="space-y-4 rounded-lg border border-outline-variant/40 p-4">
      <div className="font-label text-xs uppercase tracking-[0.2em] text-secondary">Documents</div>
      {documents.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => {
            const displayName = d.fileName ?? d.label ?? documentKindLabel(d.kind);
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant/30 px-3 py-2"
              >
                <div>
                  <div className="font-body text-sm font-medium text-on-surface">{displayName}</div>
                  <div className="font-body text-xs text-on-surface-variant">
                    {documentKindLabel(d.kind)}
                    {d.label && d.fileName ? ` · ${d.label}` : null}
                  </div>
                  <a
                    href={d.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-body text-xs text-link underline"
                  >
                    Download
                  </a>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`Remove ${displayName}`}
                  onClick={() => void remove(d.id)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3 border-t border-outline-variant/30 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`doc-kind-${entityId}`}>Document type</Label>
            <Select value={kind} disabled={busy} onValueChange={(v) => setKind(v as TKind)}>
              <SelectTrigger id={`doc-kind-${entityId}`} className="mt-1 w-full font-body text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    {documentKindLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`doc-label-${entityId}`}>Label (optional)</Label>
            <Input
              id={`doc-label-${entityId}`}
              value={label}
              disabled={busy}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1"
              maxLength={200}
              placeholder="e.g. Addendum A"
            />
          </div>
        </div>

        <DocumentUploadField
          kind={uploadKind}
          busy={busy}
          dropzone
          helperText={DOCUMENT_UPLOAD_HELPER}
          inputId={`doc-file-${entityId}`}
          onFileSelected={onFileSelected}
        />

        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          {statusMessage ? (
            <p className="font-body text-xs text-on-surface-variant">{statusMessage}</p>
          ) : null}
          {errorMessage ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-xs text-error">{errorMessage}</p>
              {retryFile ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void retryLastUpload()}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
