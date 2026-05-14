"use client";

import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { Button } from "@auction/ui/components/button";
import { useRef, useState } from "react";

export type DocumentUploadKind =
  | "lot_document"
  | "sale_document"
  | "submission_document"
  | "legal_entity_document";

type DocumentUploadFieldProps = {
  kind: DocumentUploadKind;
  value: string | null;
  onChange: (next: string | null) => void;
  busy?: boolean | undefined;
  /** What to store in `value` / pass to `onChange`: upload id for attach APIs, public URL for catalogue fields that expect a link. */
  valueMode?: "uploadObjectId" | "publicUrl";
};

export function DocumentUploadField({
  kind,
  value,
  onChange,
  busy,
  valueMode = "uploadObjectId",
}: DocumentUploadFieldProps) {
  const { uploadFile } = useUploadObjectLifecycle();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setStatus("Uploading…");
    try {
      const out = await uploadFile(file, kind);
      onChange(valueMode === "publicUrl" ? out.publicUrl : out.uploadObjectId);
      setStatus(`${file.name} · ready`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStatus(null);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(ev) => {
          void onPick(ev.target.files);
          ev.currentTarget.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        {value ? (
          <span className="max-w-[min(100%,28rem)] truncate rounded-full bg-surface-container-high px-3 py-1 font-body text-xs text-on-surface">
            {valueMode === "publicUrl" ? value : `Upload ID: ${value.slice(0, 8)}…`}
          </span>
        ) : null}
        {value ? (
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            disabled={busy}
            onClick={() => onChange(null)}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {status ? <p className="font-body text-xs text-on-surface-variant">{status}</p> : null}
      {error ? <p className="font-body text-xs text-error">{error}</p> : null}
    </div>
  );
}
