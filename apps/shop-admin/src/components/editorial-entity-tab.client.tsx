"use client";

import { EditorialBlockEditor } from "@/components/editorial-block-editor.client";
import type { EntityFieldsProps } from "@/components/editorial-entity-fields.client";
import {
  editorialButtonClass,
  editorialPrimaryButtonClass,
  editorialSmallButtonClass,
} from "@/components/editorial-form-controls";
import { EditorialErrorList, EditorialStatusMessage } from "@/components/editorial-status-message";
import { useEditorialMutation } from "@/components/use-editorial-mutation";
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
          : "rounded bg-warning-container px-2 py-0.5 text-xs text-neutral-700"
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
        <button type="button" className={editorialSmallButtonClass} onClick={onClose}>
          Dismiss
        </button>
      </div>
      <p className="text-xs text-neutral-600">
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
        <p className="text-xs text-neutral-600">
          LAX_ART_PUBLIC_URL is not configured, so only the token is shown. Open{" "}
          <code>/preview/&lt;token&gt;</code> on lax.art.
        </p>
      )}
      <code className="block break-all rounded bg-surface px-2 py-1 font-mono text-xs">
        {preview.token}
      </code>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={editorialSmallButtonClass}
          onClick={() => {
            navigator.clipboard.writeText(copyValue).then(
              () => setCopied("copied"),
              () => setCopied("failed"),
            );
          }}
        >
          {preview.url ? "Copy link" : "Copy token"}
        </button>
        <output className="text-xs text-neutral-600">
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
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (session > 0) editorHeadingRef.current?.focus();
  }, [session]);

  const currentRow = editor?.id ? rows.find((row) => row.id === editor.id) : undefined;

  function confirmDiscard(): boolean {
    return !dirty || window.confirm(`Discard unsaved changes to this ${singular}?`);
  }

  function openEditor(next: EditorState<F>) {
    setEditor(next);
    setDirty(false);
    setErrors([]);
    setSession((value) => value + 1);
  }

  function startCreate() {
    if (!confirmDiscard()) return;
    setStatus(null);
    openEditor({ id: null, form: config.empty(), items: [] });
  }

  async function startEdit(row: EditorialAdminRow) {
    if (!confirmDiscard()) return;
    const detail = await run(() => getEditorialEntityDetail(kind, row.id), {
      action: `load the ${singular}`,
      refresh: false,
    });
    if (!detail) return;
    const typed = detail as D & { body?: unknown };
    const body = Array.isArray(typed.body) ? (typed.body as EditorialBlock[]) : [];
    openEditor({ id: row.id, form: config.fromDetail(typed), items: toBlockItems(body, newKey) });
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
        <p className="text-sm text-neutral-600">
          {rows.length} {rows.length === 1 ? singular : plural}
        </p>
        <button
          type="button"
          className={editorialPrimaryButtonClass}
          disabled={pending}
          onClick={startCreate}
        >
          Create {singular}
        </button>
      </div>

      {editor ? null : <EditorialStatusMessage status={status} />}
      {preview ? <PreviewPanel preview={preview} onClose={() => setPreview(null)} /> : null}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No {plural} yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{capitalise(plural)}</caption>
            <thead>
              <tr className="border-b text-left text-neutral-500">
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
                  className={`border-b border-neutral-100 ${editor?.id === row.id ? "bg-info-container" : ""}`}
                >
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.slug}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={editorialSmallButtonClass}
                        disabled={pending}
                        aria-label={`Edit ${row.label}`}
                        onClick={() => void startEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={editorialSmallButtonClass}
                        disabled={pending}
                        aria-label={`${row.status === "published" ? "Unpublish" : "Publish"} ${row.label}`}
                        onClick={() => void togglePublished(row)}
                      >
                        {row.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className={editorialSmallButtonClass}
                        disabled={pending}
                        aria-label={`Preview ${row.label}`}
                        onClick={() => void issuePreview(row)}
                      >
                        Preview
                      </button>
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
            <button
              type="button"
              className={editorialPrimaryButtonClass}
              disabled={pending}
              onClick={() => void save()}
            >
              {pending ? "Working…" : editor.id ? "Save changes" : `Create draft ${singular}`}
            </button>
            {currentRow ? (
              <>
                <button
                  type="button"
                  className={editorialButtonClass}
                  disabled={pending || dirty}
                  title={dirty ? "Save your changes first" : undefined}
                  onClick={() => void togglePublished(currentRow)}
                >
                  {currentRow.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  className={editorialButtonClass}
                  disabled={pending || dirty}
                  title={dirty ? "Save your changes first" : undefined}
                  onClick={() => void issuePreview(currentRow)}
                >
                  Preview
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={editorialButtonClass}
              disabled={pending}
              onClick={() => {
                if (!confirmDiscard()) return;
                setEditor(null);
                setDirty(false);
                setErrors([]);
              }}
            >
              Close editor
            </button>
            {dirty ? <span className="text-xs text-neutral-500">Unsaved changes</span> : null}
          </div>
          <EditorialStatusMessage status={status} />
        </section>
      ) : null}
    </div>
  );
}
