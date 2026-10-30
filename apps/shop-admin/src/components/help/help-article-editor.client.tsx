"use client";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { EditorialBlockEditor } from "@/components/editorial-block-editor.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { fromBlockItems, toBlockItems } from "@/lib/editorial-blocks";
import { editorialMutationErrorMessage } from "@/lib/editorial-mutation-message";
import { buildEditorialPreviewUrl } from "@/lib/editorial-preview";
import {
  type HelpArticleDetail,
  type HelpArticleForm,
  buildHelpArticlePayload,
  emptyHelpArticleForm,
  helpArticleFormFromDetail,
  slugFromTitle,
} from "@/lib/help-forms";
import { SEO_DESCRIPTION_MAX_LENGTH, SEO_TITLE_MAX_LENGTH } from "@/lib/seo-fields-form";
import {
  getHelpArticleDetail,
  issueHelpPreviewToken,
  saveHelpArticle,
  setHelpArticlePublication,
} from "@/server/application/admin-help-actions.server";
import { presentStatus } from "@/server/domain/staff-status";
import type { EditorialBlock } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  EnumSelect,
  Field,
  FormActions,
  FormErrorSummary,
  FormSection,
  MappedStatusBadge,
  MetaItem,
  Notice,
  OverflowMenu,
  PageHeader,
  StaffButton,
  StaffReadOnly,
  StatusBadge,
  TextArea,
  TextInput,
  UnsavedChangesDialog,
  ViewOnlyBadge,
  formatStaffDateTime,
  toast,
  useStaffAccess,
  useStaffCan,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { Eye, EyeOff, Link2, Save } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type HelpCategoryOption = { value: string; label: string };

const SCOPE = "help-article";
const FIELD_IDS = {
  question: "help-article-question",
  categoryId: "help-article-category",
  slug: "help-article-slug",
  seoTitle: "help-article-seo-title",
  seoDescription: "help-article-seo-description",
  body: "help-article-answer",
} as const;
const SLUG_IN_USE = "That slug is already in use. Choose a different slug.";
const presentHelpStatus = presentStatus("help");

type Errors = Record<string, string>;
type Preview = { url: string | null; token: string; expiresAt: string };

const newKey = () => crypto.randomUUID();
const counter = (value: string, max: number) => `${value.trim().length} of ${max} characters`;

/** The id a field's error links to: a named field, a block, or the form-scope id of the rest. */
function fieldIdOf(field: string): string {
  if (field in FIELD_IDS) return FIELD_IDS[field as keyof typeof FIELD_IDS];
  return `${SCOPE}-${field}`;
}

function summaryOf(errors: Errors) {
  const order = ["question", "categoryId", "slug", "body"];
  const keys = Object.keys(errors).sort((a, b) => {
    const rank = (key: string) => {
      const index = order.indexOf(key);
      if (index >= 0) return index;
      return key.startsWith("block-") ? order.length : order.length + 1;
    };
    return rank(a) - rank(b);
  });
  return keys.map((key) => ({ fieldId: fieldIdOf(key), message: errors[key] as string }));
}

function signature(form: HelpArticleForm, blocks: EditorialBlock[]): string {
  return JSON.stringify([form, blocks]);
}

/**
 * Create or edit one Help centre question: details, the answer as blocks and the search listing,
 * each a form section. Errors show beside their field and in a summary, validated on submit and
 * then as fields change; leaving with unsaved edits asks first; a refused save stays on the
 * form. Publishing, unpublishing and a draft preview link apply to the saved question.
 */
export function HelpArticleEditor({
  detail,
  categories,
  defaultCategoryId,
  artPublicUrl,
}: {
  detail: HelpArticleDetail | null;
  categories: readonly HelpCategoryOption[];
  /** The category a new question starts in. */
  defaultCategoryId: string;
  artPublicUrl: string | null;
}) {
  const router = useRouter();
  /** Without `editorial.write` the question opens as a read-only view. */
  const readOnly = !useStaffCan("editorial.write");
  const { roleLabel } = useStaffAccess();
  const mode = detail ? "edit" : "create";
  const [record, setRecord] = useState(detail);
  const [form, setForm] = useState<HelpArticleForm>(() =>
    detail ? helpArticleFormFromDetail(detail) : emptyHelpArticleForm(defaultCategoryId),
  );
  const [items, setItems] = useState(() =>
    toBlockItems((detail?.body ?? []) as EditorialBlock[], newKey),
  );
  const [blockSession, setBlockSession] = useState(0);
  const [slugEdited, setSlugEdited] = useState(detail !== null);
  const [baseline, setBaseline] = useState(() =>
    signature(form, fromBlockItems(toBlockItems((detail?.body ?? []) as EditorialBlock[], newKey))),
  );
  const [version, setVersion] = useState(detail?.updatedAt ?? null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [confirmingPublication, setConfirmingPublication] = useState(false);
  const [changingPublication, setChangingPublication] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [copied, setCopied] = useState(false);

  const blocks = fromBlockItems(items);
  const dirty = signature(form, blocks) !== baseline;
  const guard = useUnsavedChanges(dirty, {
    navigate: (href) => router.push(href),
    ...(record?.question ? { label: `“${record.question}”` } : {}),
  });
  const attempted = failedSubmits > 0;
  const built = buildHelpArticlePayload(form, blocks);
  const clientErrors: Errors = attempted && !built.ok ? built.errors : {};
  const errors: Errors = { ...serverErrors, ...clientErrors };
  const summary = summaryOf(errors);

  const published = record?.status === "published";
  const title = mode === "create" ? form.question.trim() || "New question" : record?.question;

  function update(patch: Partial<HelpArticleForm>) {
    setForm((current) => ({ ...current, ...patch }));
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  }

  async function submit(expectedVersion = version) {
    if (!built.ok) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    if (mode === "edit" && !expectedVersion) return;
    setFormError(null);
    setSaving(true);
    const result = await saveHelpArticle({
      id: record?.id ?? null,
      payload: built.payload,
      expectedVersion,
      idempotencyKey,
    }).catch(() => ({ ok: false, kind: "failed", message: "" }) as const);
    setSaving(false);
    if (!result.ok) {
      if (result.kind === "conflict" && result.currentVersion) {
        setConflictVersion(result.currentVersion);
      } else if (result.kind === "conflict") {
        setServerErrors({ slug: SLUG_IN_USE });
        setFailedSubmits((count) => count + 1);
      } else {
        setFormError(editorialMutationErrorMessage(result, "save the question"));
      }
      toast.error(
        mode === "create" ? "The question was not created" : "Your changes were not saved",
      );
      return;
    }
    setIdempotencyKey(newKey());
    setConflictVersion(null);
    setFailedSubmits(0);
    setBaseline(signature(form, blocks));
    if (mode === "create") {
      toast.success(`Created “${form.question.trim()}” as a draft`);
      await guard.release();
      router.replace(`/help/${result.data.id}`);
      return;
    }
    const savedVersion = result.data.version;
    if (savedVersion) setVersion(savedVersion);
    setRecord((current) =>
      current
        ? {
            ...current,
            question: form.question.trim(),
            slug: form.slug.trim(),
            categoryId: form.categoryId,
            categoryTitle:
              categories.find((option) => option.value === form.categoryId)?.label ??
              current.categoryTitle,
            updatedAt: savedVersion ?? current.updatedAt,
          }
        : current,
    );
    toast.success("Changes saved");
    router.refresh();
  }

  async function loadTheirs() {
    if (!record) return;
    const result = await getHelpArticleDetail(record.id);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    const fresh = result.data as HelpArticleDetail;
    const nextForm = helpArticleFormFromDetail(fresh);
    const nextItems = toBlockItems(fresh.body as EditorialBlock[], newKey);
    setRecord(fresh);
    setForm(nextForm);
    setItems(nextItems);
    setBlockSession((session) => session + 1);
    setBaseline(signature(nextForm, fromBlockItems(nextItems)));
    setVersion(fresh.updatedAt);
    setConflictVersion(null);
    setServerErrors({});
    setFailedSubmits(0);
    setIdempotencyKey(newKey());
  }

  async function changePublication() {
    if (!record) return;
    const publish = !published;
    setChangingPublication(true);
    const result = await setHelpArticlePublication({
      id: record.id,
      published: publish,
      idempotencyKey: newKey(),
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setChangingPublication(false);
    setConfirmingPublication(false);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    setRecord({
      ...record,
      status: publish ? "published" : "draft",
      updatedAt: result.data.version,
    });
    setVersion(result.data.version);
    toast.success(
      publish ? `Published “${record.question}” on lax.art` : `Unpublished “${record.question}”`,
    );
    router.refresh();
  }

  async function createPreview() {
    if (!record) return;
    setPreviewing(true);
    const result = await issueHelpPreviewToken({ id: record.id, idempotencyKey: newKey() }).catch(
      () => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const,
    );
    setPreviewing(false);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    setCopied(false);
    setPreview({
      token: result.data.token,
      expiresAt: result.data.expiresAt,
      url: buildEditorialPreviewUrl(artPublicUrl, result.data.token),
    });
  }

  const publicationButton = record ? (
    <StaffButton
      variant="secondary"
      requires="editorial.publish"
      icon={published ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      disabled={dirty || changingPublication}
      onClick={() => setConfirmingPublication(true)}
    >
      {published ? "Unpublish" : "Publish"}
    </StaffButton>
  ) : null;

  const saveLabel = mode === "create" ? "Create draft" : dirty ? "Save changes" : "Saved";

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={
            <AdminBreadcrumbs
              list={{ label: "Help centre", href: "/help" }}
              current={title ?? ""}
            />
          }
          title={title}
          status={
            <>
              {record ? (
                <MappedStatusBadge status={record.status} present={presentHelpStatus} />
              ) : (
                <StatusBadge tone="info">New draft</StatusBadge>
              )}
              {readOnly ? <ViewOnlyBadge {...(roleLabel ? { role: roleLabel } : {})} /> : null}
            </>
          }
          meta={
            record ? (
              <>
                <MetaItem label="Category">{record.categoryTitle}</MetaItem>
                <MetaItem label="Updated">
                  {formatStaffDateTime(record.updatedAt, { zoneLabel: true })}
                </MetaItem>
              </>
            ) : undefined
          }
          overflow={
            record ? (
              <OverflowMenu
                actions={[
                  {
                    id: "preview",
                    requires: "editorial.write",
                    label: "Create preview link",
                    icon: Link2,
                    disabled: dirty || previewing,
                    ...(dirty ? { disabledReason: "Save your changes first" } : {}),
                    onSelect: () => void createPreview(),
                  },
                ]}
              />
            ) : undefined
          }
          secondaryActions={publicationButton ?? undefined}
        />

        {conflictVersion ? (
          <Notice
            tone="warning"
            alert
            title="Someone else saved this question after you opened it"
            actions={
              <>
                <StaffButton size="sm" variant="secondary" onClick={() => void loadTheirs()}>
                  Load their version
                </StaffButton>
                <StaffButton
                  size="sm"
                  variant="primary"
                  onClick={() => void submit(conflictVersion)}
                >
                  Save mine over it
                </StaffButton>
              </>
            }
          >
            Loading theirs discards your edits. Saving yours replaces their changes.
          </Notice>
        ) : null}
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        {preview ? (
          <Notice
            title="Draft preview link"
            actions={
              <>
                {preview.url ? (
                  <StaffButton asChild size="sm" variant="secondary">
                    <a href={preview.url} target="_blank" rel="noopener noreferrer">
                      Open preview
                    </a>
                  </StaffButton>
                ) : null}
                <StaffButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(preview.url ?? preview.token).then(
                      () => setCopied(true),
                      () => toast.error("Copy failed. Select the link and copy it."),
                    );
                  }}
                >
                  {copied ? "Copied" : preview.url ? "Copy link" : "Copy token"}
                </StaffButton>
                <StaffButton size="sm" variant="ghost" onClick={() => setPreview(null)}>
                  Dismiss
                </StaffButton>
              </>
            }
          >
            Anyone with the link can see this draft on lax.art until{" "}
            {formatStaffDateTime(preview.expiresAt, { zoneLabel: true })}.
          </Notice>
        ) : null}

        <form
          id="help-article-form"
          noValidate
          aria-label={mode === "create" ? "New question" : `Edit ${record?.question ?? "question"}`}
          className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (readOnly) return;
            void submit();
          }}
        >
          <StaffReadOnly readOnly={readOnly}>
            <FormErrorSummary errors={attempted ? summary : []} focusKey={failedSubmits} />

            <FormSection
              title="Details"
              description="The question as a reader would ask it, and where it sits in the Help centre."
            >
              <Field
                label="Question"
                description="For example, “Can I return an artwork?”"
                error={errors.question}
                id={FIELD_IDS.question}
              >
                <TextInput
                  value={form.question}
                  maxLength={300}
                  autoComplete="off"
                  onChange={(event) => {
                    const question = event.target.value;
                    update({
                      question,
                      ...(mode === "create" && !slugEdited
                        ? { slug: slugFromTitle(question) }
                        : {}),
                    });
                  }}
                />
              </Field>
              <Field
                label="Category"
                description="Saving a question in another category moves it to the end of that category."
                error={errors.categoryId}
                id={FIELD_IDS.categoryId}
              >
                <EnumSelect
                  value={form.categoryId || null}
                  onValueChange={(categoryId) => update({ categoryId })}
                  options={categories.map((category) => ({
                    value: category.value,
                    label: category.label,
                  }))}
                  placeholder="Choose a category"
                  className="sm:max-w-80"
                />
              </Field>
              <Field
                label="Web address"
                description="Lowercase letters, numbers and single hyphens."
                error={errors.slug}
                id={FIELD_IDS.slug}
              >
                <TextInput
                  value={form.slug}
                  leading={<span className="text-staff-muted">/help/</span>}
                  maxLength={120}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setSlugEdited(true);
                    update({ slug: event.target.value });
                  }}
                />
              </Field>
            </FormSection>

            <FormSection
              title="Answer"
              description="The answer shown on lax.art, built from blocks."
            >
              {errors.body ? (
                <div id={FIELD_IDS.body} tabIndex={-1} className="staff-focus rounded-staff-md">
                  <Notice tone="danger" title={errors.body} />
                </div>
              ) : null}
              <EditorialBlockEditor
                key={blockSession}
                items={items}
                errors={errors}
                disabled={saving}
                onChange={setItems}
              />
            </FormSection>

            <FormSection
              title="Search listing"
              description="How the question appears in search results. Leave blank to use the question and answer."
            >
              <Field
                label="Search title"
                optional
                description={counter(form.seoTitle, SEO_TITLE_MAX_LENGTH)}
                error={errors.seoTitle}
                id={FIELD_IDS.seoTitle}
              >
                <TextInput
                  value={form.seoTitle}
                  placeholder={form.question.trim() || "The question"}
                  onChange={(event) => update({ seoTitle: event.target.value })}
                />
              </Field>
              <Field
                label="Search description"
                optional
                description={counter(form.seoDescription, SEO_DESCRIPTION_MAX_LENGTH)}
                error={errors.seoDescription}
                id={FIELD_IDS.seoDescription}
              >
                <TextArea
                  rows={3}
                  value={form.seoDescription}
                  onChange={(event) => update({ seoDescription: event.target.value })}
                />
              </Field>
            </FormSection>
          </StaffReadOnly>

          <FormActions
            sticky
            start={
              <>
                <StaffButton asChild variant="secondary">
                  <Link href="/help">{readOnly ? "Back to questions" : "Cancel"}</Link>
                </StaffButton>
                <output aria-live="polite" className="text-staff-sm text-staff-muted">
                  {dirty ? "Unsaved changes" : ""}
                </output>
              </>
            }
          >
            <StaffButton
              type="submit"
              variant="primary"
              requires="editorial.write"
              icon={<Save aria-hidden />}
              loading={saving}
              disabled={mode === "edit" && !dirty}
            >
              {saveLabel}
            </StaffButton>
          </FormActions>
        </form>

        <ConfirmActionDialog
          open={confirmingPublication}
          onOpenChange={setConfirmingPublication}
          title={`${published ? "Unpublish" : "Publish"} “${record?.question ?? ""}”?`}
          description={
            published
              ? "The question stops showing in the Help centre on lax.art. You can publish it again later."
              : "The question and its answer appear in the Help centre on lax.art straight away, while its category is published."
          }
          confirmLabel={published ? "Unpublish question" : "Publish question"}
          loading={changingPublication}
          onConfirm={() => void changePublication()}
        />
        <UnsavedChangesDialog guard={guard} />
      </div>
    </>
  );
}
