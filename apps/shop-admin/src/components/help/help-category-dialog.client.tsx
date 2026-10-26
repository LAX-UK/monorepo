"use client";

import { editorialMutationErrorMessage } from "@/lib/editorial-mutation-message";
import {
  type HelpCategoryForm,
  buildHelpCategoryPayload,
  emptyHelpCategoryForm,
  slugFromTitle,
} from "@/lib/help-forms";
import { saveHelpCategory } from "@/server/application/admin-help-actions.server";
import type { HelpCategoryListRow } from "@/server/domain/help-list.vm";
import {
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextInput,
  toast,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

const FIELD_IDS = { title: "help-category-title", slug: "help-category-slug" } as const;
const SLUG_IN_USE = "That slug is already in use. Choose a different slug.";

type Errors = Partial<Record<"title" | "slug", string>>;

function validate(form: HelpCategoryForm): Errors {
  const built = buildHelpCategoryPayload(form);
  if (built.ok) return {};
  return {
    ...(built.errors.title ? { title: built.errors.title } : {}),
    ...(built.errors.slug ? { slug: built.errors.slug } : {}),
  };
}

/**
 * Create a category, or edit one (`category` set). Saves against the version it was opened at.
 * Errors show beside their field and in a summary, validated on submit and then as the fields
 * change; a refused save stays on the form.
 */
export function HelpCategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: HelpCategoryListRow | null;
  onClose: () => void;
  /** Called with the category's id once it is saved, for a caller that goes on to use it. */
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<HelpCategoryForm>(() =>
    category ? { slug: category.slug, title: category.title } : emptyHelpCategoryForm(),
  );
  // A new category's slug follows its title until the editor types one of their own.
  const [slugEdited, setSlugEdited] = useState(category !== null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const attempted = failedSubmits > 0;
  const errors: Errors = { ...serverErrors, ...(attempted ? validate(form) : {}) };
  const summary = (["title", "slug"] as const).flatMap((field) =>
    errors[field] ? [{ fieldId: FIELD_IDS[field], message: errors[field] as string }] : [],
  );

  function update(next: HelpCategoryForm) {
    setForm(next);
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  }

  async function save() {
    const built = buildHelpCategoryPayload(form);
    if (!built.ok) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFailure(null);
    setSaving(true);
    let result: Awaited<ReturnType<typeof saveHelpCategory>>;
    try {
      result = await saveHelpCategory({
        id: category?.id ?? null,
        payload: built.payload,
        expectedVersion: category?.updatedAt ?? null,
        idempotencyKey,
      });
    } catch {
      result = { ok: false, kind: "failed", message: "" };
    }
    setSaving(false);
    if (!result.ok) {
      if (result.kind === "conflict" && !result.currentVersion) {
        setServerErrors({ slug: SLUG_IN_USE });
        setFailedSubmits((count) => count + 1);
      } else if (result.kind === "conflict") {
        setStale(true);
      } else {
        setFailure(editorialMutationErrorMessage(result, "save the category"));
      }
      return;
    }
    setIdempotencyKey(crypto.randomUUID());
    toast.success(category ? "Category saved" : "Category created as a draft");
    router.refresh();
    onSaved?.(result.data.id);
    onClose();
  }

  return (
    <StaffDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="md"
      title={category ? `Edit “${category.title}”` : "New category"}
      description={
        category
          ? "Changing the slug changes the address of its filtered list on lax.art."
          : "Saved as a draft until you publish it."
      }
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </StaffButton>
          <StaffButton
            type="submit"
            form="help-category-form"
            variant="primary"
            loading={saving}
            disabled={stale}
          >
            {category ? "Save category" : "Create category"}
          </StaffButton>
        </>
      }
    >
      <form
        id="help-category-form"
        noValidate
        aria-label={category ? `Edit ${category.title}` : "New category"}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FormErrorSummary errors={attempted ? summary : []} focusKey={failedSubmits} />
        {stale ? (
          <Notice tone="warning" alert title="Someone else changed this category">
            Close this window and open the category again to see their changes.
          </Notice>
        ) : null}
        {failure ? <Notice tone="danger" alert title={failure} /> : null}
        <Field label="Title" error={errors.title} id={FIELD_IDS.title}>
          <TextInput
            value={form.title}
            maxLength={200}
            autoComplete="off"
            disabled={saving}
            onChange={(event) => {
              const title = event.target.value;
              update({ title, slug: slugEdited ? form.slug : slugFromTitle(title) });
            }}
          />
        </Field>
        <Field
          label="Slug"
          description="Lowercase letters, numbers and single hyphens."
          error={errors.slug}
          id={FIELD_IDS.slug}
        >
          <TextInput
            value={form.slug}
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
            onChange={(event) => {
              setSlugEdited(true);
              update({ ...form, slug: event.target.value });
            }}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
