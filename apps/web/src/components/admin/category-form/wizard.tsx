"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import {
  adminCreateCategoryResultAction,
  adminUpdateCategoryResultAction,
} from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { Category } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import {
  adminCategoryFormSchema,
  adminCreateCategoryBodySchema,
  adminUpdateCategoryBodySchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { CategoryBasicsStep } from "./steps/basics-step";
import { CategoryPresentationStep } from "./steps/presentation-step";

const CATEGORY_FORM_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "presentation", label: "Presentation" },
] as const;

type CategoryFormValues = z.infer<typeof adminCategoryFormSchema>;

type Props = {
  mode: "create" | "edit";
  categoryId?: string;
  categories: Category[];
  defaultValues: CategoryFormValues;
  /** Skip redirect to /admin/categories after save (/detail tab + sheet layouts). */
  preventNavigateAfterSave?: boolean;
  /** Runs after `router.refresh()` when save succeeds while staying on-page. */
  afterSuccessfulSave?: () => void;
  /** Cancel button navigates here (defaults to `/admin/categories`). */
  cancelHref?: string;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
};

export function AdminCategoryForm({
  mode,
  categoryId,
  categories,
  defaultValues,
  preventNavigateAfterSave = false,
  afterSuccessfulSave,
  cancelHref = "/admin/categories",
  htmlFormId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(adminCategoryFormSchema),
    defaultValues,
  });

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit((values) => {
            startTransition(async () => {
              const result =
                mode === "create"
                  ? await adminCreateCategoryResultAction(
                      adminCreateCategoryBodySchema.parse(values),
                    )
                  : categoryId
                    ? await adminUpdateCategoryResultAction(
                        categoryId,
                        adminUpdateCategoryBodySchema.parse(values),
                      )
                    : { ok: false as const, error: "Missing category" };
              if (result.ok) {
                notify.success(mode === "create" ? "Category created" : "Category saved");
                router.refresh();
                if (!preventNavigateAfterSave) {
                  router.push("/admin/categories");
                }
                afterSuccessfulSave?.();
                return;
              }
              notify.error(result.error);
            });
          })}
        >
          <AdminFormWizard
            steps={CATEGORY_FORM_STEPS}
            isDirty={form.formState.isDirty}
            pending={pending}
            leadingSlot={
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                className="min-h-11 w-full sm:w-auto"
                onClick={() => router.push(cancelHref)}
              >
                Cancel
              </Button>
            }
            submitSlot={
              <LoadingButton
                type="submit"
                loading={pending}
                loadingLabel="Saving…"
                className="min-h-11 w-full sm:min-w-40 sm:w-auto"
              >
                {mode === "create" ? "Create category" : "Save changes"}
              </LoadingButton>
            }
          >
            {(stepIndex) => (
              <>
                {stepIndex === 0 ? (
                  <CategoryBasicsStep
                    form={form}
                    {...(categoryId ? { categoryId } : {})}
                    categories={categories}
                  />
                ) : null}
                {stepIndex === 1 ? <CategoryPresentationStep form={form} mode={mode} /> : null}
              </>
            )}
          </AdminFormWizard>
        </form>
      </Form>
    </>
  );
}
