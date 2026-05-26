"use client";

import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { Button } from "@auction/ui/components/button";
import { cn } from "@auction/ui/lib/utils";
import { useCallback, useRef, useState } from "react";

export type DocumentUploadKind =
  | "lot_document"
  | "sale_document"
  | "submission_document"
  | "legal_entity_document";

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
};

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
}: DocumentUploadFieldProps) {
  const { uploadFile } = useUploadObjectLifecycle();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputId = inputId ?? `doc-upload-${kind}`;

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
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
    [kind, onChange, onFileSelected, uploadFile, valueMode],
  );

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await processFile(file);
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = ev.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  const openPicker = () => {
    if (!busy) inputRef.current?.click();
  };

  const legacyMode = !onFileSelected;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(ev) => {
          void onPick(ev.target.files);
          ev.currentTarget.value = "";
        }}
      />

      {dropzone && onFileSelected ? (
        <button
          type="button"
          disabled={busy}
          aria-label="Upload document"
          className={cn(
            "flex min-h-[7rem] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-outline-variant/50 bg-surface-container-low/30 hover:border-outline-variant",
            busy && "pointer-events-none opacity-60",
          )}
          onClick={openPicker}
          onDragEnter={(ev) => {
            ev.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={(ev) => {
            ev.preventDefault();
            setDragOver(false);
          }}
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={onDrop}
        >
          <span className="font-body text-sm text-on-surface">
            Drop a file here or <span className="text-primary underline">browse</span>
          </span>
          {helperText ? (
            <span className="mt-1 block font-body text-xs text-on-surface-variant">
              {helperText}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={openPicker}>
            Choose file
          </Button>
          {legacyMode && value ? (
            <span className="max-w-[min(100%,28rem)] truncate rounded-full bg-surface-container-high px-3 py-1 font-body text-xs text-on-surface">
              {valueMode === "publicUrl" ? value : `Upload ID: ${value.slice(0, 8)}…`}
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
