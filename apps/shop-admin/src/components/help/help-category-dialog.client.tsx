"use client";

import { TextField } from "@/components/forms/fields";
import { editorialMutationErrorMessage } from "@/lib/editorial-mutation-message";
import { type FieldErrors, hasFieldErrors } from "@/lib/form-validation";
import {
  type HelpCategoryForm,
  buildHelpCategoryPayload,
  emptyHelpCategoryForm,
  slugFromTitle,
} from "@/lib/help-forms";
import { saveHelpCategory } from "@/server/application/admin-help-actions.server";
import type { HelpCategoryListRow } from "@/server/domain/help-list.vm";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingButton,
  toast,
} from "@auction/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Create a category, or edit one (`category` set). Saves against the version it was opened at. */
export function HelpCategoryDialog({
  category,
  onClose,
}: {
  category: HelpCategoryListRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<HelpCategoryForm>(() =>
    category ? { slug: category.slug, title: category.title } : emptyHelpCategoryForm(),
  );
  // A new category's slug follows its title until the editor types one of their own.
  const [slugEdited, setSlugEdited] = useState(category !== null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function save() {
    const built = buildHelpCategoryPayload(form);
    if (!built.ok) {
      setErrors(built.errors);
      setFailure(null);
      return;
    }
    setErrors({});
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
        setErrors({ slug: "That slug is already in use. Choose a different slug." });
      } else if (result.kind === "conflict") {
        setFailure("Someone else changed this category. Close this window and open it again.");
      } else {
        setFailure(editorialMutationErrorMessage(result, "save the category"));
      }
      return;
    }
    setIdempotencyKey(crypto.randomUUID());
    toast.success(category ? "Category saved." : "Category created as a draft.");
    router.refresh();
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md border-border-hairline">
        <DialogHeader>
          <DialogTitle>{category ? `Edit “${category.title}”` : "New category"}</DialogTitle>
          <DialogDescription>
            {category
              ? "Changing the slug changes the address of its filtered list on lax.art."
              : "Saved as a draft until you publish it."}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}
          {hasFieldErrors(errors) ? (
            <p role="alert" className="text-sm text-error">
              Check the highlighted fields and try again.
            </p>
          ) : null}
          <TextField
            name="title"
            label="Title"
            value={form.title}
            error={errors.title}
            maxLength={200}
            required
            disabled={saving}
            onChange={(title) =>
              setForm({ title, slug: slugEdited ? form.slug : slugFromTitle(title) })
            }
          />
          <TextField
            name="slug"
            label="Slug"
            hint="Lowercase letters, numbers and single hyphens."
            value={form.slug}
            error={errors.slug}
            maxLength={120}
            required
            disabled={saving}
            onChange={(slug) => {
              setSlugEdited(true);
              setForm({ ...form, slug });
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <LoadingButton type="submit" loading={saving} loadingLabel="Saving…">
              {category ? "Save category" : "Create category"}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
