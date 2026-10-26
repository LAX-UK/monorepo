"use client";

import {
  StaffCheckboxField,
  StaffTextAreaField,
  StaffTextField,
  staffFieldId,
} from "@/components/admin/forms/staff-form-fields";
import { useStaffForm } from "@/components/admin/forms/use-staff-form";
import { StaffSingleImage } from "@/components/admin/media/staff-single-image";
import {
  adminCreateCategoryResultAction,
  adminUpdateCategoryResultAction,
} from "@/lib/actions/admin";
import { NO_PARENT_ID, parentPickerOptions } from "@/lib/admin/categories/parent-picker-options";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { notify } from "@/lib/ui/notify";
import {
  EntityPicker,
  Field,
  FormActions,
  FormErrorSummary,
  FormSection,
  Notice,
  StaffButton,
  UnsavedChangesDialog,
} from "@auction/staff-ui";
import type { Category } from "@auction/types";
import { adminCategoryFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useController } from "react-hook-form";
import type { z } from "zod";

export type CategoryFormValues = z.infer<typeof adminCategoryFormSchema>;

const CATEGORY_FORM_ID = "category-form";
const FIELD_ORDER = ["name", "parentId", "sortOrder", "heroImageKey", "description", "archived"];

type Props = {
  mode: "create" | "edit";
  categoryId?: string;
  /** The category's name, for "Discard changes to …?". */
  name?: string;
  /** Shown on edit; the web address was set when the category was created. */
  slug?: string;
  categories: Category[];
  defaultValues: CategoryFormValues;
  /** Cancel goes here (defaults to the categories list). */
  cancelHref?: string;
};

/**
 * Creating or editing a category as one page of sections: name, place in the tree, picture and
 * copy, and (when editing) whether it is archived. Validates on submit and again as each field
 * changes, lists what to fix at the top, and asks before unsaved changes are lost.
 */
export function AdminCategoryForm({
  mode,
  categoryId,
  name,
  slug,
  categories,
  defaultValues,
  cancelHref = "/admin/categories",
}: Props) {
  const router = useRouter();
  const idempotencyKey = useRef(`category-create-${crypto.randomUUID()}`);
  const [saving, setSaving] = useState(false);
  const { form, guard, summary, submitCount, formError, setFormError, markSaved, leave } =
    useStaffForm<CategoryFormValues>({
      resolver: zodResolver(adminCategoryFormSchema, STAFF_PARSE_PARAMS),
      defaultValues,
      formId: CATEGORY_FORM_ID,
      fieldOrder: FIELD_ORDER,
      ...(name ? { label: name } : {}),
    });
  const parent = useController({ control: form.control, name: "parentId" });
  const hero = useController({ control: form.control, name: "heroImageKey" });
  const parentOptions = useMemo(
    () => parentPickerOptions(categories, categoryId),
    [categories, categoryId],
  );
  const currentParent = categories.find((category) => category.id === parent.field.value);
  const f = { control: form.control, formId: CATEGORY_FORM_ID } as const;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    setSaving(true);
    try {
      const result =
        mode === "create"
          ? await adminCreateCategoryResultAction(values, idempotencyKey.current)
          : categoryId
            ? await adminUpdateCategoryResultAction(categoryId, values)
            : { ok: false as const, error: "This category could not be found." };
      if (result.ok) {
        markSaved();
        if (mode === "create") {
          notify.success(`${values.name} created`);
          await leave(
            result.data && "id" in result.data
              ? `/admin/categories/${(result.data as { id: string }).id}`
              : "/admin/categories",
          );
          return;
        }
        notify.success("Changes saved");
        router.refresh();
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        applyActionFieldErrors(form, result.fieldErrors, { focusField: false });
        return;
      }
      setFormError(result.error);
    } finally {
      setSaving(false);
    }
  });

  return (
    <>
      <form
        id={CATEGORY_FORM_ID}
        noValidate
        aria-label={mode === "create" ? "New category" : "Edit category"}
        className="flex flex-col gap-6"
        onSubmit={submit}
      >
        <FormErrorSummary errors={summary} focusKey={submitCount} />
        {formError ? (
          <Notice tone="danger" alert title="The category was not saved">
            {formError}
          </Notice>
        ) : null}

        <FormSection
          title="Identity"
          description={
            mode === "edit"
              ? "The name shown in the catalogue. The web address was set when the category was created."
              : "The name shown in the catalogue. A unique web address is made from it when you save."
          }
        >
          <StaffTextField {...f} name="name" label="Name" placeholder="e.g. Contemporary art" />
          {mode === "edit" && slug ? (
            <Field label="Web address" description="Cannot be changed.">
              <p className="font-mono text-staff-sm text-staff-fg">/{slug}</p>
            </Field>
          ) : null}
        </FormSection>

        <FormSection
          title="Place in the tree"
          description="Which category this one sits under, and its order among its siblings."
        >
          <Field
            id={staffFieldId(CATEGORY_FORM_ID, "parentId")}
            label="Parent category"
            optional
            description="Leave as no parent for a top-level category."
            error={parent.fieldState.error?.message}
          >
            <EntityPicker
              id={staffFieldId(CATEGORY_FORM_ID, "parentId")}
              value={parent.field.value ?? NO_PARENT_ID}
              options={parentOptions}
              selected={currentParent ? { id: currentParent.id, label: currentParent.name } : null}
              placeholder="No parent"
              searchPlaceholder="Search categories"
              emptyText="No categories match."
              onValueChange={(option) =>
                parent.field.onChange(!option || option.id === NO_PARENT_ID ? null : option.id)
              }
            />
          </Field>
          <StaffTextField
            {...f}
            name="sortOrder"
            label="Sort order"
            description="Lower numbers come first among siblings."
            integer
            optional
            placeholder="0"
          />
        </FormSection>

        <FormSection
          title="Presentation"
          description="The picture and copy for the public category page."
        >
          <Field
            id={staffFieldId(CATEGORY_FORM_ID, "heroImageKey")}
            label="Hero image"
            optional
            description="A banner shown at the top of the category page."
            error={hero.fieldState.error?.message}
          >
            <StaffSingleImage
              kind="category_image"
              value={hero.field.value}
              onChange={(next) => hero.field.onChange(next)}
              noun="hero image"
            />
          </Field>
          <StaffTextAreaField {...f} name="description" label="Description" optional rows={5} />
        </FormSection>

        {mode === "edit" ? (
          <FormSection title="Status" description="Archive a category without deleting it.">
            <StaffCheckboxField
              {...f}
              name="archived"
              label="Archived"
              description="Archived categories stay in history but are left out of the pickers."
            />
          </FormSection>
        ) : null}

        <FormActions sticky>
          <StaffButton asChild variant="secondary">
            <Link href={cancelHref}>Cancel</Link>
          </StaffButton>
          <StaffButton type="submit" variant="primary" loading={saving}>
            {mode === "create" ? "Create category" : "Save changes"}
          </StaffButton>
        </FormActions>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}
