"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import type { DocumentUploadKind } from "@/components/forms/document-upload-field";
import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { documentKindLabel } from "@/lib/admin/document-kind-labels";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import {
  type DataColumn,
  EnumSelect,
  Field,
  FieldRow,
  FileDropzone,
  PrimaryCell,
  StaffDate,
  TextInput,
  UploadQueue,
  type UploadQueueItem,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { DocumentEntityKind, EntityDocument } from "@auction/types";
import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

const UPLOAD_KIND: Record<DocumentEntityKind, DocumentUploadKind> = {
  lot: "lot_document",
  sale: "sale_document",
  submission: "submission_document",
};

export type StaffDocumentActions<TKind extends string> = {
  attach: (input: {
    uploadObjectId: string;
    kind: TKind;
    label: string | null;
  }) => Promise<ActionResult<EntityDocument>>;
  remove: (documentId: string) => Promise<ActionResult<void>>;
};

type Props<TKind extends string> = {
  id?: string;
  title: string;
  /** Who sees these files: "Staff only. Not shown on the public sale page." */
  description: string;
  entityKind: DocumentEntityKind;
  /** The kinds a new file can be; one kind needs no choice. */
  kinds: readonly TKind[];
  documents: readonly EntityDocument[];
  actions: StaffDocumentActions<TKind>;
  /** Staff who cannot change the record see the files without the upload. */
  canManage?: boolean;
  empty: { title: string; description: string };
};

/** A file on its way in, kept with what was chosen for it so a retry sends the same. */
type QueueEntry = UploadQueueItem & { file: File; kind: string; label: string };

export function documentDisplayName(doc: Pick<EntityDocument, "fileName" | "label" | "kind">) {
  return doc.label?.trim() || doc.fileName || documentKindLabel(doc.kind);
}

function fileSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * One group of a record's files on the kit: a table of what is attached (open or remove from
 * each row's menu, removal confirmed), then a drop area to add more with the type and an
 * optional label. Each upload shows its progress; a failure stays with the file and a retry.
 */
export function StaffDocumentsSection<K extends string>({
  id,
  title,
  description,
  entityKind,
  kinds,
  documents: initialDocuments,
  actions,
  canManage = true,
  empty,
}: Props<K>) {
  const router = useRouter();
  const formId = useId();
  const confirm = useStaffConfirm();
  const { uploadFile } = useUploadObjectLifecycle();
  const [documents, setDocuments] = useState<readonly EntityDocument[]>(initialDocuments);
  const [kind, setKind] = useState<K>(kinds[0] as K);
  const [label, setLabel] = useState("");
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => setDocuments(initialDocuments), [initialDocuments]);

  const patch = useCallback(
    (itemId: string, next: Partial<QueueEntry>) =>
      setQueue((items) => items.map((item) => (item.id === itemId ? { ...item, ...next } : item))),
    [],
  );

  const send = useCallback(
    async (itemId: string, file: File, fileKind: K, fileLabel: string) => {
      try {
        const uploaded = await uploadFile(file, UPLOAD_KIND[entityKind]);
        patch(itemId, { status: "processing" });
        const result = await actions.attach({
          uploadObjectId: uploaded.uploadObjectId,
          kind: fileKind,
          label: fileLabel.trim() === "" ? null : fileLabel.trim(),
        });
        if (!result.ok || !result.data) {
          throw new Error(result.ok ? "The server did not return the document." : result.error);
        }
        const created = result.data;
        setDocuments((docs) => [...docs, created]);
        setQueue((items) => items.filter((item) => item.id !== itemId));
        notify.success(`${documentDisplayName(created)} added`);
        router.refresh();
      } catch (error) {
        patch(itemId, {
          status: "error",
          error: error instanceof Error ? error.message : "The document could not be added.",
        });
      }
    },
    [actions, entityKind, patch, router, uploadFile],
  );

  const add = (files: File[]) => {
    for (const file of files) {
      const itemId = crypto.randomUUID();
      const entry: QueueEntry = {
        id: itemId,
        name: file.name,
        status: "uploading",
        progress: 30,
        file,
        kind,
        label,
      };
      setQueue((items) => [...items, entry]);
      void send(itemId, file, kind, label);
    }
    setLabel("");
  };

  const retry = (itemId: string) => {
    const entry = queueRef.current.find((item) => item.id === itemId);
    if (!entry) return;
    setQueue((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        const { error: _error, ...rest } = item;
        return { ...rest, status: "uploading", progress: 30 };
      }),
    );
    void send(itemId, entry.file, entry.kind as K, entry.label);
  };

  const askRemove = (doc: EntityDocument) => {
    const name = documentDisplayName(doc);
    confirm.ask({
      title: `Remove ${name}?`,
      description: "The file is detached from this record and can no longer be opened from it.",
      confirmLabel: "Remove document",
      tone: "danger",
      run: async () => {
        const result = await actions.remove(doc.id);
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },
      success: `${name} removed`,
      onSuccess: () => {
        setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
        router.refresh();
      },
    });
  };

  const columns: DataColumn<EntityDocument>[] = [
    {
      id: "document",
      header: "Document",
      mobile: "title",
      sortable: true,
      sortValue: (doc) => documentDisplayName(doc).toLowerCase(),
      cell: (doc) => {
        const name = documentDisplayName(doc);
        const second = [
          kinds.length > 1 || doc.label ? documentKindLabel(doc.kind) : null,
          doc.label && doc.fileName ? doc.fileName : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <PrimaryCell href={doc.downloadUrl} {...(second ? { secondary: second } : {})} external>
            {name}
          </PrimaryCell>
        );
      },
    },
    {
      id: "size",
      header: "Size",
      numeric: true,
      width: "96px",
      hideBelow: "md",
      cell: (doc) => fileSize(doc.byteSize) ?? "—",
    },
    {
      id: "added",
      header: "Added",
      width: "140px",
      sortable: true,
      defaultSortDirection: "desc",
      sortValue: (doc) => new Date(doc.createdAt).getTime(),
      mobile: "meta",
      cell: (doc) => <StaffDate value={new Date(doc.createdAt).toISOString()} />,
    },
    rowActionsColumn<EntityDocument>({
      label: (doc) => `Actions for ${documentDisplayName(doc)}`,
      actions: (doc) => [
        {
          id: "open",
          label: "Open",
          icon: Download,
          onSelect: () => window.open(doc.downloadUrl, "_blank", "noopener"),
        },
        ...(canManage
          ? [
              {
                id: "remove",
                label: "Remove…",
                icon: Trash2,
                tone: "danger" as const,
                onSelect: () => askRemove(doc),
              },
            ]
          : []),
      ],
    }),
  ];

  return (
    <>
      <RelatedRecordsSection<EntityDocument>
        {...(id ? { id } : {})}
        title={title}
        description={description}
        label={title}
        columns={columns}
        data={documents}
        getRowId={(doc) => doc.id}
        defaultSort={{ columnId: "added", direction: "desc" }}
        empty={empty}
      >
        {canManage ? (
          <div className="flex flex-col gap-3">
            {queue.length > 0 ? (
              <UploadQueue
                items={queue}
                onRetry={retry}
                onDismiss={(itemId) =>
                  setQueue((items) => items.filter((item) => item.id !== itemId))
                }
              />
            ) : null}
            <FieldRow>
              {kinds.length > 1 ? (
                <Field id={`${formId}-kind`} label="Type">
                  <EnumSelect<K>
                    value={kind}
                    onValueChange={setKind}
                    options={kinds.map((k) => ({ value: k, label: documentKindLabel(k) }))}
                  />
                </Field>
              ) : null}
              <Field
                id={`${formId}-label`}
                label="Label"
                optional
                description="Shown instead of the file name."
              >
                <TextInput
                  value={label}
                  maxLength={200}
                  placeholder="e.g. Addendum A"
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
            </FieldRow>
            <FileDropzone
              label="Upload a document"
              kind="file"
              accept={DOCUMENT_ACCEPT}
              multiple
              compact={documents.length > 0}
              hint="PDF, JPEG, PNG or WebP, up to 25 MB each."
              onFiles={add}
            />
          </div>
        ) : null}
      </RelatedRecordsSection>
      {confirm.dialog}
    </>
  );
}
