"use client";

import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { Button } from "@auction/ui/components/button";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { useCallback, useState } from "react";

export type DocumentUploadKind =
  | "lot_document"
  | "sale_document"
  | "submission_document"
  | "legal_entity_document"
  | "source_of_funds_document";

type DocumentUploadFieldProps = {
  kind: DocumentUploadKind;
  /** Required when `onFileSelected` is not used (legacy upload-to-id flow). */
  value?: string | null;
  onChange?: (next: string | null) => void;
  busy?: boolean | undefined;
  /** What to store in `value` / pass to `onChange`: upload id for attach APIs, public URL for catalogue fields that expect a link. */
  valueMode?: "uploadObjectId" | "publicUrl";
  /** When set, parent owns upload + attach; this field only handles file pick/drop. */
  onFileSelected?: (file: File) => Promise<void>;
  /** Bordered drop area with drag-and-drop (requires `onFileSelected`). */
  dropzone?: boolean;
  helperText?: string;
  inputId?: string;
  /** Links helper/constraints text for screen readers (aria-describedby). */
  describedById?: string;
  /** Optional client-side max size (bytes) before upload starts. */
  maxBytes?: number;
};

const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export function DocumentUploadField({
  kind,
  value = null,
  onChange,
  busy,
  valueMode = "uploadObjectId",
  onFileSelected,
  dropzone = false,
  helperText,
  inputId,
  describedById,
  maxBytes,
}: DocumentUploadFieldProps) {
  const { uploadFile } = useUploadObjectLifecycle();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputId = inputId ?? `doc-upload-${kind}`;

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      if (maxBytes != null && file.size > maxBytes) {
        setError(`File is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)`);
        return;
      }
      if (onFileSelected) {
        await onFileSelected(file);
        return;
      }

      if (!onChange) {
        throw new Error("DocumentUploadField requires onChange when onFileSelected is not set");
      }

      setStatus("Uploading…");
      try {
        const out = await uploadFile(file, kind);
        onChange(valueMode === "publicUrl" ? out.publicUrl : out.uploadObjectId);
        setStatus(`${file.name} · ready`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        setStatus(null);
      }
    },
    [kind, maxBytes, onChange, onFileSelected, uploadFile, valueMode],
  );

  async function onPick(files: FileList) {
    const file = files[0];
    if (!file) return;
    await processFile(file);
  }

  const legacyMode = !onFileSelected;

  return (
    <div className="space-y-2">
      {dropzone && onFileSelected ? (
        <FileUploadTrigger
          dropzone
          disabled={Boolean(busy)}
          busy={Boolean(busy)}
          accept={DOCUMENT_ACCEPT}
          inputId={fileInputId}
          {...(describedById ? { describedById } : {})}
          {...(helperText ? { helperText } : {})}
          onFilesSelected={(files) => void onPick(files)}
        >
          <span className="font-body text-sm text-on-surface">
            Drop a file here or <span className="text-link underline">browse</span>
          </span>
        </FileUploadTrigger>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <FileUploadTrigger
            disabled={Boolean(busy)}
            busy={Boolean(busy)}
            accept={DOCUMENT_ACCEPT}
            inputId={fileInputId}
            onFilesSelected={(files) => void onPick(files)}
          >
            Choose file
          </FileUploadTrigger>
          {legacyMode && value && status ? (
            <span className="max-w-[min(100%,28rem)] truncate rounded-full bg-surface-container-high px-3 py-1 font-body text-xs text-on-surface">
              {status}
            </span>
          ) : null}
          {legacyMode && value ? (
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              disabled={busy}
              onClick={() => onChange?.(null)}
            >
              Clear
            </Button>
          ) : null}
        </div>
      )}

      {helperText && !(dropzone && onFileSelected) ? (
        <p className="font-body text-xs text-on-surface-variant">{helperText}</p>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {status ? <p className="font-body text-xs text-on-surface-variant">{status}</p> : null}
        {error ? <p className="font-body text-xs text-error">{error}</p> : null}
      </div>
    </div>
  );
}
