"use client";

import { EditorialBlockEditor } from "@/components/editorial-block-editor.client";
import { EditorialConflictBanner } from "@/components/editorial/editorial-conflict-banner.client";
import {
  type EntityFieldsProps,
  FieldSection,
} from "@/components/editorial/editorial-field-parts.client";
import {
  type EditorialPreview,
  EditorialPreviewPanel,
} from "@/components/editorial/editorial-preview-panel.client";
import { EditorialStatusBadge } from "@/components/editorial/editorial-status-badge";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { FormScopeProvider } from "@/components/forms/form-field";
import { useUnsavedNavigationGuard } from "@/components/use-unsaved-changes-guard";
import { type EditorialBlockItem, fromBlockItems, toBlockItems } from "@/lib/editorial-blocks";
import type { EditorialEntityCopy } from "@/lib/editorial-entities";
import type {
  EditorialEntityKind,
  EditorialPublicationStatus,
  PayloadResult,
} from "@/lib/editorial-entity-forms";
import { editorialMutationErrorMessage } from "@/lib/editorial-mutation-message";
import { buildEditorialPreviewUrl } from "@/lib/editorial-preview";
import { formatLondonTime } from "@/lib/editorial-time";
import { type FieldErrors, hasFieldErrors } from "@/lib/form-validation";
import {
  getEditorialEntityDetail,
  issueEditorialPreviewToken,
  saveEditorialEntity,
  setEditorialPublication,
} from "@/server/application/admin-editorial-actions.server";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import type { EditorialBlock } from "@auction/shop-contracts";
import {
  Alert,
  AlertDescription,
  Button,
  ConfirmDialog,
  LoadingButton,
  StatusBadge,
  StickySaveBar,
  toast,
} from "@auction/ui";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useId, useRef, useState } from "react";

/** What every editorial entity detail carries, whatever its kind. */
export type EditorialDetailBase = {
  id: string;
  status: EditorialPublicationStatus;
  /** The row's `updatedAt`, sent back as `expectedVersion` on save. */
  updatedAt: string;
  body: unknown[];
};

export type EditorialEditorConfig<F, D extends EditorialDetailBase> = {
  entity: EditorialEntityCopy;
  empty: () => F;
  fromDetail: (detail: D) => F;
  buildPayload: (form: F, blocks: EditorialBlock[]) => PayloadResult<unknown>;
  /** Names the item in confirmations, e.g. its title. */
  nameOf: (form: F) => string;
  /** Lets a form record that it now matches what is stored (for example the saved story kind). */
  afterSave?: (form: F) => F;
  renderFields: (props: EntityFieldsProps<F>) => ReactNode;
};

type Failure = { text: string; stepUp: boolean };
type Busy = "save" | "publish" | "reload" | "preview";
type Dialog = "publish" | "reload" | "overwrite";

const SLUG_IN_USE = "That slug is already in use. Choose a different slug.";
const newKey = () => crypto.randomUUID();

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function failureFrom(
  result: Exclude<AdminMutationResult<unknown>, { ok: true }>,
  action: string,
): Failure {
  return {
    text: editorialMutationErrorMessage(result, action),
    stepUp: result.kind === "step_up_required",
  };
}

/**
 * One editor for every editorial entity: fields for the kind, the block body, an explicit Save in
 * a sticky bar, publish and preview for saved items, and protection against losing edits either
 * by leaving the page or by saving over someone else's newer save.
 */
export function EditorialEditor<F, D extends EditorialDetailBase>({
  config,
  detail,
  artPublicUrl,
}: {
  config: EditorialEditorConfig<F, D>;
  /** The stored item, or null to create a new draft. */
  detail: D | null;
  artPublicUrl: string | null;
}) {
  const { entity } = config;
  const kind: EditorialEntityKind = entity.kind;
  const id = detail?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const scope = useId();

  const [form, setForm] = useState<F>(() => (detail ? config.fromDetail(detail) : config.empty()));
  const [items, setItems] = useState<EditorialBlockItem[]>(() =>
    toBlockItems((detail?.body ?? []) as EditorialBlock[], newKey),
  );
  const [blockSession, setBlockSession] = useState(0);
  const [version, setVersion] = useState<string | null>(detail?.updatedAt ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(detail?.updatedAt ?? null);
  const [status, setStatus] = useState<EditorialPublicationStatus>(detail?.status ?? "draft");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [preview, setPreview] = useState<EditorialPreview | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const { pendingHref, stay, leave } = useUnsavedNavigationGuard(dirty);

  /** A repeat of the same request reuses its key; a changed request gets a new one. */
  function keyFor(signature: string): string {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newKey() };
    return attempt.current.key;
  }

  async function attemptMutation<T>(
    work: () => Promise<AdminMutationResult<T>>,
  ): Promise<AdminMutationResult<T>> {
    try {
      return await work();
    } catch {
      return { ok: false, kind: "failed", message: "" };
    }
  }

  async function save(expectedVersion: string | null = version) {
    const built = config.buildPayload(form, fromBlockItems(items));
    if (!built.ok) {
      setErrors(built.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy("save");
    const signature = JSON.stringify([id, expectedVersion, built.payload]);
    const result = await attemptMutation(() =>
      saveEditorialEntity({
        kind,
        id,
        payload: built.payload,
        expectedVersion,
        idempotencyKey: keyFor(signature),
      }),
    );
    setBusy(null);
    if (!result.ok) {
      if (result.kind === "conflict" && result.currentVersion) {
        setConflictVersion(result.currentVersion);
      } else if (result.kind === "conflict") {
        setErrors({ slug: SLUG_IN_USE });
      } else {
        setFailure(failureFrom(result, `save the ${entity.singular}`));
      }
      return;
    }
    attempt.current = null;
    setDirty(false);
    setConflictVersion(null);
    if (config.afterSave) setForm(config.afterSave(form));
    if (id === null) {
      toast.success(`${capitalise(entity.singular)} created as a draft.`);
      router.replace(`/editorial/${kind}/${result.data.id}`);
      return;
    }
    setVersion(result.data.version);
    setSavedAt(result.data.version);
    toast.success(`${capitalise(entity.singular)} saved.`);
  }

  async function changePublication() {
    if (!id) return;
    const publish = status !== "published";
    setBusy("publish");
    setFailure(null);
    const result = await attemptMutation(() =>
      setEditorialPublication({
        kind,
        id,
        published: publish,
        idempotencyKey: keyFor(`${id}:${publish}:${version}`),
      }),
    );
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      setFailure(
        failureFrom(result, `${publish ? "publish" : "unpublish"} the ${entity.singular}`),
      );
      return;
    }
    attempt.current = null;
    setStatus(publish ? "published" : "draft");
    setVersion(result.data.version);
    toast.success(
      `${capitalise(entity.singular)} ${publish ? "published on lax.art" : "unpublished"}.`,
    );
  }

  async function createPreview() {
    if (!id) return;
    setBusy("preview");
    setFailure(null);
    const result = await attemptMutation(() =>
      issueEditorialPreviewToken({ kind, id, idempotencyKey: newKey() }),
    );
    setBusy(null);
    if (!result.ok) {
      setFailure(failureFrom(result, "create a preview link"));
      return;
    }
    setPreview({
      token: result.data.token,
      expiresAt: result.data.expiresAt,
      url: buildEditorialPreviewUrl(artPublicUrl, result.data.token),
    });
  }

  /** Replaces the editor with what is stored now, discarding every unsaved edit. */
  async function reloadFromStore() {
    if (!id) return;
    setBusy("reload");
    const result = await attemptMutation(() => getEditorialEntityDetail(kind, id));
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      setFailure(failureFrom(result, `reload the ${entity.singular}`));
      return;
    }
    const fresh = result.data as D;
    setForm(config.fromDetail(fresh));
    setItems(toBlockItems(fresh.body as EditorialBlock[], newKey));
    setBlockSession((session) => session + 1);
    setVersion(fresh.updatedAt);
    setSavedAt(fresh.updatedAt);
    setStatus(fresh.status);
    setDirty(false);
    setErrors({});
    setFailure(null);
    setConflictVersion(null);
  }

  const disabled = busy !== null;
  const name = config.nameOf(form);
  const publishing = status !== "published";
  const editField = (next: F) => {
    setForm(next);
    setDirty(true);
  };

  return (
    <FormScopeProvider value={scope}>
      <form
        noValidate
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {id ? (
            <EditorialStatusBadge status={status} />
          ) : (
            <StatusBadge variant="info">New draft</StatusBadge>
          )}
          {id ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || dirty}
                onClick={() => void createPreview()}
              >
                Create preview link
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || dirty}
                onClick={() => setDialog("publish")}
              >
                {publishing ? "Publish" : "Unpublish"}
              </Button>
            </div>
          ) : null}
        </div>
        {id && dirty ? (
          <p className="-mt-4 text-sm text-on-surface-variant">
            Save your changes before publishing or creating a preview link.
          </p>
        ) : null}

        {preview ? (
          <EditorialPreviewPanel preview={preview} onClose={() => setPreview(null)} />
        ) : null}
        {conflictVersion ? (
          <EditorialConflictBanner
            singular={entity.singular}
            savedAt={formatLondonTime(conflictVersion)}
            busy={disabled}
            onReload={() => setDialog("reload")}
            onKeepMine={() => setDialog("overwrite")}
          />
        ) : null}
        {failure ? (
          <Alert variant="destructive">
            <AlertDescription>
              {failure.text}
              {failure.stepUp ? (
                <>
                  {" "}
                  <a
                    href={`/api/auth/login?returnTo=${encodeURIComponent(pathname)}`}
                    className="underline"
                  >
                    Sign in again
                  </a>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {hasFieldErrors(errors) ? <FormErrorSummary scope={scope} errors={errors} /> : null}

        {config.renderFields({ form, onChange: editField, disabled, errors })}

        <FieldSection title="Body" description="The content of the page, built from blocks.">
          <div className="sm:col-span-2">
            <EditorialBlockEditor
              key={blockSession}
              items={items}
              errors={errors}
              disabled={disabled}
              onChange={(next) => {
                setItems(next);
                setDirty(true);
              }}
            />
          </div>
        </FieldSection>

        {/* Linked artworks, artists and stories are edited here for exhibitions and stories. */}

        <StickySaveBar>
          <div className="flex flex-wrap items-center gap-3">
            <LoadingButton
              type="submit"
              loading={busy === "save"}
              loadingLabel="Saving…"
              disabled={disabled}
            >
              {id ? "Save changes" : "Create draft"}
            </LoadingButton>
            <output aria-live="polite" className="text-sm text-on-surface-variant">
              {dirty
                ? "Unsaved changes"
                : savedAt
                  ? `Saved ${formatLondonTime(savedAt)}`
                  : "Not saved yet"}
            </output>
          </div>
        </StickySaveBar>
      </form>

      <ConfirmDialog
        open={dialog === "publish"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`${publishing ? "Publish" : "Unpublish"} “${name}”`}
        body={
          publishing
            ? `This ${entity.singular} goes live on lax.art straight away.`
            : `This ${entity.singular} is removed from lax.art straight away. You can publish it again later.`
        }
        confirmLabel={publishing ? "Publish" : "Unpublish"}
        tone="warning"
        loading={busy === "publish"}
        onConfirm={changePublication}
      />
      <ConfirmDialog
        open={dialog === "reload"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Discard your changes to “${name}”?`}
        body={`Reloading shows the version saved at ${conflictVersion ? formatLondonTime(conflictVersion) : "the last save"}. Your unsaved changes to this ${entity.singular} are lost and cannot be recovered.`}
        confirmLabel="Discard my changes and reload"
        cancelLabel="Keep editing"
        loading={busy === "reload"}
        onConfirm={reloadFromStore}
      />
      <ConfirmDialog
        open={dialog === "overwrite"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Save over the other changes to “${name}”?`}
        body={`Saving now replaces what was saved at ${conflictVersion ? formatLondonTime(conflictVersion) : "the last save"} with your version of this ${entity.singular}. Their changes cannot be recovered afterwards.`}
        confirmLabel="Save my version"
        cancelLabel="Go back"
        loading={busy === "save"}
        onConfirm={async () => {
          const current = conflictVersion;
          setDialog(null);
          if (current) await save(current);
        }}
      />
      <ConfirmDialog
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) stay();
        }}
        title="Leave without saving?"
        body={`Your changes to this ${entity.singular} have not been saved and will be lost.`}
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        onConfirm={leave}
      />
    </FormScopeProvider>
  );
}
