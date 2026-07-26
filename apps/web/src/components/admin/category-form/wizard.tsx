"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import { WizardValidationBanner } from "@/components/admin/admin-form-wizard/wizard-validation-banner";
import { useCatalogValidationBanner } from "@/components/admin/catalog/use-catalog-form-submit";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import {
  adminCreateCategoryResultAction,
  adminUpdateCategoryResultAction,
} from "@/lib/actions/admin";
import {
  applyZodErrorsToForm,
  zodIssuePathForForm as zodPathJoin,
} from "@/lib/admin/zod-form-errors";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
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
import { useCallback, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { CategoryBasicsStep } from "./steps/basics-step";
import { CategoryPresentationStep } from "./steps/presentation-step";

const CATEGORY_FORM_STEPS = [
  {
    id: "basics",
    label: "Basics",
    subItems: ["Identity", "Hierarchy"],
  },
  {
    id: "presentation",
    label: "Presentation",
    subItems: ["Media", "Description", "Availability"],
  },
] as const;

type CategoryFormValues = z.infer<typeof adminCategoryFormSchema>;

const CATEGORY_STEP_FIELDS: (keyof CategoryFormValues)[][] = [
  ["name", "parentId", "sortOrder"],
  ["heroImageKey", "archived", "description"],
];

type Props = {
  mode: "create" | "edit";
  categoryId?: string;
  /** Read-only slug for edit display (not part of form values). */
  slug?: string;
  categories: Category[];
  defaultValues: CategoryFormValues;
  /** Skip redirect to /admin/categories after save (/detail tab + sheet layouts). */
  preventNavigateAfterSave?: boolean;
  /** Runs after `router.refresh()` when save succeeds while staying on-page. */
  afterSuccessfulSave?: (categoryId?: string) => void;
  /** Cancel button navigates here (defaults to `/admin/categories`). */
  cancelHref?: string;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
  /** Full-page edit uses a right sidebar stepper; create sheet and quick edit keep horizontal chips. */
  wizardLayout?: "default" | "sidebar";
};

export function AdminCategoryForm({
  mode,
  categoryId,
  slug,
  categories,
  defaultValues,
  preventNavigateAfterSave = false,
  afterSuccessfulSave,
  cancelHref = "/admin/categories",
  htmlFormId,
  wizardLayout = "default",
}: Props) {
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const [pending, startTransition] = useTransition();
  const {
    validationBanner,
    validationStepIndex,
    setValidationFailure,
    clearValidationBanner,
    notifyValidationFailure,
  } = useCatalogValidationBanner();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(adminCategoryFormSchema),
    defaultValues,
  });
  const createIdempotencyKeyRef = useRef(`category-create-${crypto.randomUUID()}`);
  const wizardGoToRef = useRef<(index: number) => void>(() => {});

  const validateAllWizardSteps = useCallback(async () => {
    for (let i = 0; i < CATEGORY_STEP_FIELDS.length; i++) {
      const fields = CATEGORY_STEP_FIELDS[i];
      if (fields?.length && !(await validateWizardStep(form, adminCategoryFormSchema, fields))) {
        wizardGoToRef.current(i);
        setValidationFailure("Complete this step before saving.", i);
        return false;
      }
    }
    return true;
  }, [form, setValidationFailure]);

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit((values) => {
            startTransition(async () => {
              clearValidationBanner();
              if (!(await validateAllWizardSteps())) {
                setValidationFailure("Complete each step before saving.");
                notifyValidationFailure({});
                return;
              }
              const parsedBody =
                mode === "create"
                  ? adminCreateCategoryBodySchema.safeParse(values)
                  : adminUpdateCategoryBodySchema.safeParse(values);
              if (!parsedBody.success) {
                for (const iss of parsedBody.error.issues) {
                  const path = iss.path.length ? zodPathJoin(iss.path) : "root";
                  applyZodErrorsToForm(form, path, iss.message);
                }
                setValidationFailure("Check the form for errors");
                notifyValidationFailure({});
                return;
              }
              const result =
                mode === "create"
                  ? await adminCreateCategoryResultAction(
                      parsedBody.data as z.infer<typeof adminCreateCategoryBodySchema>,
                      createIdempotencyKeyRef.current,
                    )
                  : categoryId
                    ? await adminUpdateCategoryResultAction(categoryId, parsedBody.data)
                    : { ok: false as const, error: "Missing category" };
              if (result.ok) {
                notify.success(mode === "create" ? "Category created" : "Category saved");
                router.refresh();
                const newId = mode === "create" ? result.data?.id : undefined;
                if (!preventNavigateAfterSave && newId) {
                  router.push(`/admin/categories/${newId}?created=1`);
                } else if (!preventNavigateAfterSave) {
                  router.push("/admin/categories");
                }
                afterSuccessfulSave?.(newId);
                return;
              }
              if (result.fieldErrors) {
                applyActionFieldErrors(form, result.fieldErrors, {
                  stepFields: CATEGORY_STEP_FIELDS,
                  goTo: wizardGoToRef.current,
                });
                setValidationFailure("Check the highlighted fields.");
                notifyValidationFailure({});
                return;
              }
              setValidationFailure(result.error);
              notify.error(result.error);
            });
          })}
        >
          {validationBanner ? (
            <WizardValidationBanner
              message={validationBanner}
              {...(validationStepIndex != null && CATEGORY_FORM_STEPS[validationStepIndex]?.label
                ? {
                    stepLabel: CATEGORY_FORM_STEPS[validationStepIndex].label,
                    onJumpToStep: () => wizardGoToRef.current(validationStepIndex),
                  }
                : {})}
            />
          ) : null}
          <AdminFormWizard
            className="space-y-6"
            steps={CATEGORY_FORM_STEPS}
            isDirty={form.formState.isDirty}
            pending={pending}
            layout={wizardLayout}
            hideStickyOnMobile={wizardLayout === "sidebar" && Boolean(htmlFormId)}
            showSubmitOnAllSteps={wizardLayout === "sidebar" && mode === "edit"}
            onStepControl={({ goTo }) => {
              wizardGoToRef.current = goTo;
            }}
            onBeforeNext={async (stepIndex) => {
              const fields = CATEGORY_STEP_FIELDS[stepIndex];
              if (!fields?.length) return true;
              return validateWizardStep(form, adminCategoryFormSchema, fields);
            }}
            leadingSlot={
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                className="min-h-11 w-full sm:w-auto"
                onClick={() => guardedPush(cancelHref)}
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
                    mode={mode}
                    {...(categoryId ? { categoryId } : {})}
                    {...(mode === "edit" && slug ? { slug } : {})}
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
