"use client";

import { EditorialBlockEditor } from "@/components/editorial-block-editor.client";
import type { EntityFieldsProps } from "@/components/editorial-entity-fields.client";
import { EditorialErrorList, EditorialStatusMessage } from "@/components/editorial-status-message";
import { useEditorialMutation } from "@/components/use-editorial-mutation";
import { useUnsavedChangesGuard } from "@/components/use-unsaved-changes-guard";
import { type EditorialBlockItem, fromBlockItems, toBlockItems } from "@/lib/editorial-blocks";
import type {
  EditorialAdminRow,
  EditorialEntityKind,
  PayloadResult,
} from "@/lib/editorial-entity-forms";
import { buildEditorialPreviewUrl } from "@/lib/editorial-preview";
import {
  getEditorialEntityDetail,
  issueEditorialPreviewToken,
  saveEditorialEntity,
  setEditorialPublication,
} from "@/server/application/admin-editorial-actions.server";
import type { EditorialBlock } from "@auction/shop-contracts";
import { Button, ConfirmDialog } from "@auction/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

export type EditorialEntityTabConfig<F, D> = {
  kind: EditorialEntityKind;
  singular: string;
  plural: string;
  empty: () => F;
  fromDetail: (detail: D) => F;
  buildPayload: (form: F, blocks: EditorialBlock[]) => PayloadResult<unknown>;
  renderFields: (props: EntityFieldsProps<F>) => ReactNode;
};

type EditorState<F> = { id: string | null; form: F; items: EditorialBlockItem[] };

type PreviewState = { label: string; token: string; expiresAt: string; url: string | null };

const newKey = () => crypto.randomUUID();

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StatusBadge({ status }: { status: EditorialAdminRow["status"] }) {
  return (
    <span
      className={
        status === "published"
          ? "rounded bg-success-container px-2 py-0.5 text-xs text-success"
          : "rounded bg-warning-container px-2 py-0.5 text-xs text-on-surface-variant"
      }
    >
      {status === "published" ? "Published" : "Draft"}
    </span>
  );
}

function PreviewPanel({ preview, onClose }: { preview: PreviewState; onClose: () => void }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const copyValue = preview.url ?? preview.token;
  return (
    <section
      aria-label="Draft preview link"
      className="space-y-2 rounded border border-outline bg-info-container p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Preview for {preview.label}</p>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Dismiss
        </Button>
      </div>
      <p className="text-xs text-on-surface-variant">
        Expires {new Date(preview.expiresAt).toLocaleString("en-GB")}. Anyone with the link can view
        the draft until then.
      </p>
      {preview.url ? (
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all text-link underline"
        >
          {preview.url}
        </a>
      ) : (
        <p className="text-xs text-on-surface-variant">
          LAX_ART_PUBLIC_URL is not configured, so only the token is shown. Open{" "}
          <code>/preview/&lt;token&gt;</code> on lax.art.
        </p>
      )}
      <code className="block break-all rounded bg-surface px-2 py-1 font-mono text-xs">
        {preview.token}
      </code>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(copyValue).then(
              () => setCopied("copied"),
              () => setCopied("failed"),
            );
          }}
        >
          {preview.url ? "Copy link" : "Copy token"}
        </Button>
        <output className="text-xs text-on-surface-variant">
          {copied === "copied"
            ? "Copied."
            : copied === "failed"
              ? "Copy failed; select it manually."
              : ""}
        </output>
      </div>
    </section>
  );
}

export function EditorialEntityTab<F, D>({
  config,
  rows,
  artPublicUrl,
}: {
  config: EditorialEntityTabConfig<F, D>;
  rows: readonly EditorialAdminRow[];
  artPublicUrl: string | null;
}) {
  const { kind, singular, plural } = config;
  const { status, setStatus, pending, run } = useEditorialMutation();
  const [editor, setEditor] = useState<EditorState<F> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [session, setSession] = useState(0);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const [publicationTarget, setPublicationTarget] = useState<EditorialAdminRow | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (session > 0) editorHeadingRef.current?.focus();
  }, [session]);

  const currentRow = editor?.id ? rows.find((row) => row.id === editor.id) : undefined;

  useUnsavedChangesGuard(dirty);

  /** Runs `proceed` straight away, or after the user agrees to drop unsaved edits. */
  function guardDiscard(proceed: () => void) {
    if (dirty) setDiscardAction(() => proceed);
    else proceed();
  }

  function openEditor(next: EditorState<F>) {
    setEditor(next);
    setDirty(false);
    setErrors([]);
    setSession((value) => value + 1);
  }

  function startCreate() {
    guardDiscard(() => {
      setStatus(null);
      openEditor({ id: null, form: config.empty(), items: [] });
    });
  }

  async function loadForEdit(row: EditorialAdminRow) {
    const detail = await run(() => getEditorialEntityDetail(kind, row.id), {
      action: `load the ${singular}`,
      refresh: false,
    });
    if (!detail) return;
    const typed = detail as D & { body?: unknown };
    const body = Array.isArray(typed.body) ? (typed.body as EditorialBlock[]) : [];
    openEditor({ id: row.id, form: config.fromDetail(typed), items: toBlockItems(body, newKey) });
  }

  function startEdit(row: EditorialAdminRow) {
    guardDiscard(() => void loadForEdit(row));
  }

  async function save() {
    if (!editor) return;
    const result = config.buildPayload(editor.form, fromBlockItems(editor.items));
    if (!result.ok) {
      setStatus(null);
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const isCreate = editor.id === null;
    const saved = await run(
      (idempotencyKey) =>
        saveEditorialEntity({ kind, id: editor.id, payload: result.payload, idempotencyKey }),
      {
        action: `save the ${singular}`,
        success: isCreate
          ? `${capitalise(singular)} created as a draft.`
          : `${capitalise(singular)} saved.`,
      },
    );
    if (!saved) return;
    setEditor((current) => (current ? { ...current, id: saved.id } : current));
    setDirty(false);
  }

  async function togglePublished(row: EditorialAdminRow) {
    const publish = row.status !== "published";
    await run(
      (idempotencyKey) =>
        setEditorialPublication({ kind, id: row.id, published: publish, idempotencyKey }),
      {
        action: publish ? `publish the ${singular}` : `unpublish the ${singular}`,
        success: publish ? `Published “${row.label}”.` : `Unpublished “${row.label}”.`,
      },
    );
  }

  async function issuePreview(row: EditorialAdminRow) {
    setPreview(null);
    const data = await run(
      (idempotencyKey) => issueEditorialPreviewToken({ kind, id: row.id, idempotencyKey }),
      { action: "issue a preview link", refresh: false },
    );
    if (!data) return;
    setPreview({
      label: row.label,
      token: data.token,
      expiresAt: data.expiresAt,
      url: buildEditorialPreviewUrl(artPublicUrl, data.token),
    });
  }

  const updateEditor = (patch: Partial<EditorState<F>>) => {
    setEditor((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">
          {rows.length} {rows.length === 1 ? singular : plural}
        </p>
        <Button type="button" size="sm" disabled={pending} onClick={startCreate}>
          Create {singular}
        </Button>
      </div>

      {editor ? null : <EditorialStatusMessage status={status} />}
      {preview ? <PreviewPanel preview={preview} onClose={() => setPreview(null)} /> : null}

      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No {plural} yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{capitalise(plural)}</caption>
            <thead>
              <tr className="border-b text-left text-on-surface-variant">
                <th scope="col" className="py-1 pr-4">
                  Name
                </th>
                <th scope="col" className="py-1 pr-4">
                  Slug
                </th>
                <th scope="col" className="py-1 pr-4">
                  Status
                </th>
                <th scope="col" className="py-1">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border-hairline ${editor?.id === row.id ? "bg-info-container" : ""}`}
                >
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.slug}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        aria-label={`Edit ${row.label}`}
                        onClick={() => startEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        aria-label={`${row.status === "published" ? "Unpublish" : "Publish"} ${row.label}`}
                        onClick={() => setPublicationTarget(row)}
                      >
                        {row.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        aria-label={`Preview ${row.label}`}
                        onClick={() => void issuePreview(row)}
                      >
                        Preview
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor ? (
        <section
          className="space-y-4 rounded border p-4"
          aria-labelledby={`${kind}-editor-heading`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id={`${kind}-editor-heading`}
              ref={editorHeadingRef}
              tabIndex={-1}
              className="text-lg font-medium"
            >
              {editor.id ? `Edit ${singular}: ${currentRow?.label ?? ""}` : `New ${singular}`}
            </h2>
            {currentRow ? <StatusBadge status={currentRow.status} /> : null}
          </div>
          {config.renderFields({
            form: editor.form,
            disabled: pending,
            onChange: (form) => updateEditor({ form }),
          })}
          <EditorialBlockEditor
            key={session}
            items={editor.items}
            disabled={pending}
            onChange={(items) => updateEditor({ items })}
          />
          <EditorialErrorList errors={errors} />
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
              {pending ? "Working…" : editor.id ? "Save changes" : `Create draft ${singular}`}
            </Button>
            {currentRow ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || dirty}
                  title={dirty ? "Save your changes first" : undefined}
                  onClick={() => setPublicationTarget(currentRow)}
                >
                  {currentRow.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || dirty}
                  title={dirty ? "Save your changes first" : undefined}
                  onClick={() => void issuePreview(currentRow)}
                >
                  Preview
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                guardDiscard(() => {
                  setEditor(null);
                  setDirty(false);
                  setErrors([]);
                })
              }
            >
              Close editor
            </Button>
            {dirty ? (
              <span className="text-xs text-on-surface-variant">Unsaved changes</span>
            ) : null}
          </div>
          <EditorialStatusMessage status={status} />
        </section>
      ) : null}

      <ConfirmDialog
        open={discardAction !== null}
        onOpenChange={(open) => {
          if (!open) setDiscardAction(null);
        }}
        title={`Discard unsaved changes to this ${singular}?`}
        body="Your edits have not been saved and cannot be recovered once discarded."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          discardAction?.();
          setDiscardAction(null);
        }}
      />
      <ConfirmDialog
        open={publicationTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPublicationTarget(null);
        }}
        title={`${publicationTarget?.status === "published" ? "Unpublish" : "Publish"} “${publicationTarget?.label ?? ""}”`}
        body={
          publicationTarget?.status === "published"
            ? `This ${singular} is removed from lax.art straight away. You can publish it again later.`
            : `This ${singular} goes live on lax.art straight away.`
        }
        confirmLabel={publicationTarget?.status === "published" ? "Unpublish" : "Publish"}
        tone="warning"
        loading={pending}
        onConfirm={async () => {
          if (!publicationTarget) return;
          await togglePublished(publicationTarget);
          setPublicationTarget(null);
        }}
      />
    </div>
  );
}
