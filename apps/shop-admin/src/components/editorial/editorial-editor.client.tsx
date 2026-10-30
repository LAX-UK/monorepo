"use client";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { EditorialBlockEditor } from "@/components/editorial-block-editor.client";
import { EditorialConflictBanner } from "@/components/editorial/editorial-conflict-banner.client";
import type { EditorialEditorApi } from "@/components/editorial/editorial-editor-api";
import {
  type EntityFieldsProps,
  FieldSection,
  editorialFieldId,
} from "@/components/editorial/editorial-field-parts.client";
import {
  EditorialLinkLists,
  EditorialLinksAfterFirstSave,
} from "@/components/editorial/editorial-link-lists.client";
import {
  type EditorialPreview,
  EditorialPreviewPanel,
} from "@/components/editorial/editorial-preview-panel.client";
import type { LinksController } from "@/components/editorial/use-editorial-links.client";
import { type EditorialBlockItem, fromBlockItems, toBlockItems } from "@/lib/editorial-blocks";
import type { EditorialPublicationStatus, PayloadResult } from "@/lib/editorial-entity-forms";
import { editorialMutationErrorMessage } from "@/lib/editorial-mutation-message";
import { buildEditorialPreviewUrl } from "@/lib/editorial-preview";
import { formatLondonTime } from "@/lib/editorial-time";
import type { FieldErrors } from "@/lib/form-validation";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { publicationDialogCopy } from "@/server/domain/editorial-publication.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { EditorialBlock } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  FormActions,
  FormErrorSummary,
  MappedStatusBadge,
  MetaItem,
  Notice,
  OverflowMenu,
  PageHeader,
  StaffButton,
  StaffReadOnly,
  UnsavedChangesDialog,
  ViewOnlyBadge,
  formatStaffDateTime,
  toast,
  useStaffAccess,
  useStaffCan,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { Eye, EyeOff, Link as LinkIcon, Save } from "@auction/staff-ui/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

const EDITORIAL_WRITE = "editorial.write";
const EDITORIAL_PUBLISH = "editorial.publish";

const presentEditorialStatus = presentStatus("editorial");

/** What every editorial entity detail carries, whatever its kind. */
export type EditorialDetailBase = {
  id: string;
  status: EditorialPublicationStatus;
  /** The row's `updatedAt`, sent back as `expectedVersion` on save. */
  updatedAt: string;
  body: unknown[];
};

export type EditorialEditorConfig<F, D extends EditorialDetailBase> = {
  /** `singular` is lower case, for sentences such as "Someone else saved this exhibition". */
  entity: { singular: string };
  /** Where the entity is saved, published, previewed and reloaded from. */
  api: EditorialEditorApi;
  /** Heading and help text of the block editor; defaults suit a page. */
  body?: { title: string; description: string };
  /**
   * The page around the editor: a trail back to the list, and the heading of a new item. Without
   * it the page shows no trail and calls a new item "New <singular>".
   */
  page?: { list: { label: string; href: string }; newTitle: string };
  empty: () => F;
  fromDetail: (detail: D) => F;
  buildPayload: (form: F, blocks: EditorialBlock[]) => PayloadResult<unknown>;
  /** Names the item in confirmations, e.g. its title. */
  nameOf: (form: F) => string;
  /** Where the item lives on lax.art ("lax.art/exhibitions/summer-show"), when it has an address. */
  publicAddress?: (form: F) => string | null;
  /** Lets a form record that it now matches what is stored (for example the saved story kind). */
  afterSave?: (form: F) => F;
  renderFields: (props: EntityFieldsProps<F>) => ReactNode;
  /**
   * What an item with linked records says about them before its first save, when there is
   * nothing to attach them to yet: "Artists, artworks and exhibitions".
   */
  linksBeforeFirstSave?: string;
};

type Failure = { text: string; stepUp: boolean };
type Busy = "save" | "publish" | "reload" | "preview";
type Dialog = "publish" | "reload" | "overwrite";

const DEFAULT_BODY = {
  title: "Body",
  description: "The content of the page, built from blocks.",
};
const SLUG_IN_USE = "That slug is already in use. Choose a different slug.";
const newKey = () => crypto.randomUUID();

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
 * One editor for every editorial entity: a record page with fields for the kind, the block body
 * and the linked records, one Save, publish and preview for saved items, and protection against
 * losing edits either by leaving the page or by saving over someone else's newer save. Problems
 * are found on submit and re-checked as the person fixes them; a failed save stays on the form.
 */
export function EditorialEditor<F, D extends EditorialDetailBase>({
  config,
  detail,
  artPublicUrl,
  links = null,
}: {
  config: EditorialEditorConfig<F, D>;
  /** The stored item, or null to create a new draft. */
  detail: D | null;
  artPublicUrl: string | null;
  /**
   * The linked records of a saved item. They are saved by the same Save as the rest of the item,
   * after its fields, so there is one place to save and one unsaved-changes state.
   */
  links?: LinksController | null;
}) {
  const { entity, api } = config;
  const id = detail?.id ?? null;
  const router = useRouter();
  /** Without `editorial.write` the item opens as a read-only view. */
  const readOnly = !useStaffCan(EDITORIAL_WRITE);
  const { roleLabel } = useStaffAccess();
  const pathname = usePathname();

  const [form, setForm] = useState<F>(() => (detail ? config.fromDetail(detail) : config.empty()));
  const [items, setItems] = useState<EditorialBlockItem[]>(() =>
    toBlockItems((detail?.body ?? []) as EditorialBlock[], newKey),
  );
  const [blockSession, setBlockSession] = useState(0);
  const [version, setVersion] = useState<string | null>(detail?.updatedAt ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(detail?.updatedAt ?? null);
  const [savedName, setSavedName] = useState<string | null>(
    detail ? config.nameOf(config.fromDetail(detail)) : null,
  );
  const [status, setStatus] = useState<EditorialPublicationStatus>(detail?.status ?? "draft");
  const [dirty, setDirty] = useState(false);
  const linksDirty = links?.dirty ?? false;
  /** Failed submits so far; problems show live, and re-check as they are fixed, once there is one. */
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [preview, setPreview] = useState<EditorialPreview | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const name = config.nameOf(form);
  const leaveGuard = useUnsavedChanges(dirty || linksDirty, {
    navigate: (href) => router.push(href),
    ...(savedName ? { label: `“${savedName}”` } : {}),
  });
  const releaseGuard = leaveGuard.release;

  const clientErrors: FieldErrors = (() => {
    if (failedSubmits === 0) return {};
    const built = config.buildPayload(form, fromBlockItems(items));
    return built.ok ? {} : built.errors;
  })();
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const summary = Object.entries(errors).map(([field, message]) => ({
    fieldId: editorialFieldId(field),
    message,
  }));

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

  /**
   * Saves the linked records. When the item's own fields were saved a moment ago, a failure says
   * so, so nobody saves them twice or thinks they were lost.
   */
  async function saveLinks(fieldsAlreadySaved: boolean): Promise<boolean> {
    if (!links?.dirty) return true;
    setBusy("save");
    const result = await links.save();
    setBusy(null);
    if (result.ok) return true;
    if (result.kind === "failed") {
      setFailure({
        text: fieldsAlreadySaved
          ? `Your changes to the ${entity.singular} were saved, but the linked records were not. ${result.text}`
          : result.text,
        stepUp: result.stepUp,
      });
    }
    return false;
  }

  async function save(expectedVersion: string | null = version) {
    // Linked records alone changed: the item's own fields are not sent again.
    const savingFields = id === null || dirty;
    if (savingFields) {
      const built = config.buildPayload(form, fromBlockItems(items));
      if (!built.ok) {
        setFailedSubmits((count) => count + 1);
        setFailure(null);
        return;
      }
      setServerErrors({});
      setFailure(null);
      setBusy("save");
      const signature = JSON.stringify([id, expectedVersion, built.payload]);
      const result = await attemptMutation(() =>
        api.save({
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
          setServerErrors({ slug: SLUG_IN_USE });
          setFailedSubmits((count) => count + 1);
        } else {
          setFailure(failureFrom(result, `save the ${entity.singular}`));
        }
        toast.error(`The ${entity.singular} was not saved`);
        return;
      }
      attempt.current = null;
      setDirty(false);
      setFailedSubmits(0);
      setConflictVersion(null);
      if (config.afterSave) setForm(config.afterSave(form));
      if (id === null) {
        toast.success(`Created “${config.nameOf(form)}” as a draft`);
        await releaseGuard();
        router.replace(api.detailHref(result.data.id));
        return;
      }
      setVersion(result.data.version);
      setSavedAt(result.data.version);
      setSavedName(config.nameOf(form));
    } else {
      setFailure(null);
    }
    if (!(await saveLinks(savingFields))) return;
    if (!savingFields) setSavedAt(new Date().toISOString());
    toast.success("Changes saved");
  }

  async function changePublication() {
    if (!id) return;
    const publish = status !== "published";
    setBusy("publish");
    setFailure(null);
    const result = await attemptMutation(() =>
      api.setPublication({
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
    setSavedAt(result.data.version);
    toast.success(
      publish
        ? `Published “${name}” on lax.art`
        : `Unpublished “${name}”. It no longer shows on lax.art`,
    );
  }

  async function createPreview() {
    if (!id) return;
    setBusy("preview");
    setFailure(null);
    const result = await attemptMutation(() => api.createPreview({ id, idempotencyKey: newKey() }));
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
    const result = await attemptMutation(() => api.reload(id));
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      setFailure(failureFrom(result, `reload the ${entity.singular}`));
      return;
    }
    const fresh = result.data as D;
    const freshForm = config.fromDetail(fresh);
    setForm(freshForm);
    setSavedName(config.nameOf(freshForm));
    setItems(toBlockItems(fresh.body as EditorialBlock[], newKey));
    setBlockSession((session) => session + 1);
    setVersion(fresh.updatedAt);
    setSavedAt(fresh.updatedAt);
    setStatus(fresh.status);
    setDirty(false);
    setFailedSubmits(0);
    setServerErrors({});
    setFailure(null);
    setConflictVersion(null);
  }

  const disabled = busy !== null;
  const body = config.body ?? DEFAULT_BODY;
  const publishing = status !== "published";
  const unsaved = dirty || linksDirty;
  const address = config.publicAddress?.(form) ?? null;
  const editField = (next: F) => {
    setForm(next);
    setDirty(true);
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  };
  const title = id
    ? (savedName ?? name)
    : name.trim() || (config.page?.newTitle ?? `New ${entity.singular}`);
  const submitLabel = id === null ? "Create draft" : unsaved ? "Save changes" : "Saved";
  const publishCopy = publicationDialogCopy({
    publish: publishing,
    noun: entity.singular,
    name: savedName ?? name,
    address,
  });

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          {...(config.page
            ? {
                breadcrumbs: <AdminBreadcrumbs list={config.page.list} current={title} />,
              }
            : {})}
          title={title}
          status={
            <>
              <MappedStatusBadge status={status} present={presentEditorialStatus} />
              {readOnly ? <ViewOnlyBadge {...(roleLabel ? { role: roleLabel } : {})} /> : null}
            </>
          }
          meta={
            id ? (
              <>
                {savedAt ? (
                  <MetaItem label="Updated">
                    {formatStaffDateTime(savedAt, { zoneLabel: true })}
                  </MetaItem>
                ) : null}
                {status === "published" && address ? (
                  <MetaItem label="Public address">{address}</MetaItem>
                ) : null}
              </>
            ) : undefined
          }
          secondaryActions={
            id ? (
              <StaffButton
                type="button"
                variant="secondary"
                requires={EDITORIAL_PUBLISH}
                icon={publishing ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                disabled={disabled || unsaved}
                onClick={() => setDialog("publish")}
              >
                {publishing ? "Publish" : "Unpublish"}
              </StaffButton>
            ) : undefined
          }
          overflow={
            id ? (
              <OverflowMenu
                actions={[
                  {
                    id: "preview",
                    requires: EDITORIAL_WRITE,
                    label: "Create preview link",
                    icon: LinkIcon,
                    disabled: disabled || unsaved,
                    ...(unsaved ? { disabledReason: "Save your changes first" } : {}),
                    onSelect: () => void createPreview(),
                  },
                ]}
              />
            ) : undefined
          }
        />

        {id && unsaved ? (
          <p className="sr-only" aria-live="polite">
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
          <Notice
            tone="danger"
            alert
            title={failure.text}
            {...(failure.stepUp
              ? {
                  actions: (
                    <StaffButton asChild size="sm" variant="secondary">
                      <a href={`/api/auth/login?returnTo=${encodeURIComponent(pathname)}`}>
                        Sign in again
                      </a>
                    </StaffButton>
                  ),
                }
              : {})}
          />
        ) : null}

        <form
          noValidate
          aria-label={id ? `Edit ${title}` : (config.page?.newTitle ?? `New ${entity.singular}`)}
          className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (readOnly) return;
            void save();
          }}
        >
          <StaffReadOnly readOnly={readOnly}>
            <FormErrorSummary errors={summary} focusKey={failedSubmits} />

            {config.renderFields({ form, onChange: editField, disabled, errors })}

            <FieldSection title={body.title} description={body.description}>
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
            </FieldSection>

            {links ? (
              <EditorialLinkLists
                controller={links}
                readOnly={readOnly}
                onFailure={(next) => setFailure(next)}
              />
            ) : id === null && config.linksBeforeFirstSave ? (
              <EditorialLinksAfterFirstSave what={config.linksBeforeFirstSave} />
            ) : null}
          </StaffReadOnly>

          <FormActions
            sticky
            start={
              <>
                <StaffButton asChild variant="secondary">
                  <Link href={config.page?.list.href ?? pathname}>
                    {readOnly ? "Back to list" : "Cancel"}
                  </Link>
                </StaffButton>
                <output aria-live="polite" className="text-staff-sm text-staff-muted">
                  {unsaved ? "Unsaved changes" : ""}
                </output>
              </>
            }
          >
            <StaffButton
              type="submit"
              variant="primary"
              requires={EDITORIAL_WRITE}
              icon={<Save aria-hidden />}
              loading={busy === "save"}
              disabled={disabled || (id !== null && !unsaved)}
            >
              {submitLabel}
            </StaffButton>
          </FormActions>
        </form>
      </div>

      <ConfirmActionDialog
        open={dialog === "publish"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={publishCopy.title}
        description={publishCopy.description}
        confirmLabel={publishCopy.confirmLabel}
        tone={publishing ? "default" : "danger"}
        loading={busy === "publish"}
        onConfirm={changePublication}
      />
      <ConfirmActionDialog
        open={dialog === "reload"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Discard your changes to “${name}”?`}
        description={`Reloading shows the version saved at ${conflictVersion ? formatLondonTime(conflictVersion) : "the last save"}. Your unsaved changes to this ${entity.singular} are lost and cannot be recovered.`}
        confirmLabel="Discard my changes and reload"
        cancelLabel="Keep editing"
        tone="danger"
        loading={busy === "reload"}
        onConfirm={reloadFromStore}
      />
      <ConfirmActionDialog
        open={dialog === "overwrite"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Save over the other changes to “${name}”?`}
        description={`Saving now replaces what was saved at ${conflictVersion ? formatLondonTime(conflictVersion) : "the last save"} with your version of this ${entity.singular}. Their changes cannot be recovered afterwards.`}
        confirmLabel="Save my version"
        cancelLabel="Go back"
        tone="danger"
        loading={busy === "save"}
        onConfirm={async () => {
          const current = conflictVersion;
          setDialog(null);
          if (current) await save(current);
        }}
      />
      <UnsavedChangesDialog guard={leaveGuard} />
    </>
  );
}
