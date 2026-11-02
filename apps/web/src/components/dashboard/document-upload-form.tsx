"use client";

import { DocumentUploadField } from "@/components/forms/document-upload-field";
import type { DocumentUploadKind } from "@/components/forms/document-upload-field";
import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { DOCUMENT_UPLOAD_HELPER, documentKindLabel } from "@/lib/admin/document-kind-labels";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import type { DocumentEntityKind, EntityDocument } from "@auction/types";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Button } from "@auction/ui/lax";
import { useCallback, useRef, useState } from "react";

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

export type DocumentUploadFormProps<TKind extends string> = {
  entityKind: DocumentEntityKind;
  entityId: string;
  kinds: readonly TKind[];
  attach: (input: {
    uploadObjectId: string;
    kind: TKind;
    label: string | null;
  }) => Promise<ActionResult<EntityDocument>>;
  /** The document once it is saved on the record. */
  onAttached: (document: EntityDocument) => void;
};

/**
 * Adds a document to a record in one step: choose its type, an optional label, then drop or
 * browse for the file. It uploads and attaches at once, says what it is doing, and offers to try
 * again when a file does not go through.
 */
export function DocumentUploadForm<TKind extends string>({
  entityKind,
  entityId,
  kinds,
  attach,
  onAttached,
}: DocumentUploadFormProps<TKind>) {
  const { uploadFile } = useUploadObjectLifecycle();
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
  const uploadKind = uploadKindForEntity(entityKind);

  const addDocument = useCallback(
    async (file: File) => {
      setBusy(true);
      setErrorMessage(null);
      setRetryFile(null);
      setStatusMessage(`Uploading ${file.name}…`);
      try {
        const uploaded = await uploadFile(file, uploadKind);
        setStatusMessage(`Saving ${file.name}…`);
        const res = await attach({
          uploadObjectId: uploaded.uploadObjectId,
          kind: kindRef.current,
          label: labelRef.current.trim() === "" ? null : labelRef.current.trim(),
        });
        if (!res.ok) throw new Error(res.error ?? "Could not save document");
        if (res.data === undefined) throw new Error("Invalid server response");
        onAttached(res.data);
        setLabel("");
        notify.success("Document added");
        setStatusMessage(null);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "Could not add document");
        setRetryFile(file);
        setStatusMessage(null);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [attach, onAttached, uploadFile, uploadKind],
  );

  async function retryLastUpload() {
    if (!retryFile) return;
    try {
      await addDocument(retryFile);
    } catch {
      // The error shows in errorMessage.
    }
  }

  return (
    <div className="space-y-3">
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
        onFileSelected={addDocument}
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
                size="md"
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
  );
}
