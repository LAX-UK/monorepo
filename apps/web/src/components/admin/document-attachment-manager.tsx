"use client";

import { DocumentUploadField } from "@/components/forms/document-upload-field";
import type { DocumentUploadKind } from "@/components/forms/document-upload-field";
import type { ActionResult } from "@/lib/forms/form-result";
import type { DocumentEntityKind, EntityDocument } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { useMemo, useState } from "react";

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
  const [documents, setDocuments] = useState<EntityDocument[]>(initialDocuments);
  const [kind, setKind] = useState<TKind>(kinds[0] as TKind);
  const [label, setLabel] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const uploadKind = useMemo(() => uploadKindForEntity(entityKind), [entityKind]);

  async function attach() {
    if (!pendingId) {
      setMessage("Upload a file first");
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await actions.attach({
      uploadObjectId: pendingId,
      kind,
      label: label.trim() === "" ? null : label.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    if (res.data === undefined) {
      setMessage("Invalid response");
      return;
    }
    const created = res.data;
    setDocuments((prev) => [...prev, created]);
    setPendingId(null);
    setLabel("");
    setMessage("Attached");
  }

  async function remove(documentId: string) {
    setBusy(true);
    setMessage(null);
    const res = await actions.remove(documentId);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
  }

  return (
    <div className="space-y-4 rounded-lg border border-outline-variant/40 p-4">
      <div className="font-label text-xs uppercase tracking-[0.2em] text-secondary">Documents</div>
      {documents.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant/30 px-3 py-2"
            >
              <div>
                <div className="font-body text-sm font-medium text-on-surface">{d.kind}</div>
                {d.label ? (
                  <div className="font-body text-xs text-on-surface-variant">{d.label}</div>
                ) : null}
                <a
                  href={d.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-body text-xs text-primary underline"
                >
                  Download
                </a>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void remove(d.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-outline-variant/30 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`doc-kind-${entityId}`}>Kind</Label>
            <select
              id={`doc-kind-${entityId}`}
              className="mt-1 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body text-sm"
              value={kind}
              disabled={busy}
              onChange={(e) => setKind(e.target.value as TKind)}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
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
            />
          </div>
        </div>
        <DocumentUploadField
          kind={uploadKind}
          value={pendingId}
          onChange={setPendingId}
          busy={busy}
        />
        <Button type="button" disabled={busy || !pendingId} onClick={() => void attach()}>
          Attach to record
        </Button>
        {message ? <p className="font-body text-xs text-on-surface-variant">{message}</p> : null}
      </div>
    </div>
  );
}
