"use client";

import {
  adminCreateLotResultAction,
  adminUpdateLotMarketingDetailsResultAction,
  adminUpdateLotResultAction,
} from "@/lib/actions/admin";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import { lotFormStepLabel, lotFormValidationBanner } from "@/lib/admin/lot-form-field-ownership";
import { applyZodIssuesToForm } from "@/lib/forms/apply-action-field-errors";
import {
  type AdminLotFormValues,
  formValuesToImageAltsPatch,
  safeParseCreateLotFromForm,
  safeParseUpdateLotFromForm,
} from "@/lib/forms/schemas/admin-lot-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { UseFormReturn } from "react-hook-form";
import type { z as zod } from "zod";

type SubmitArgs = {
  mode: "create" | "edit";
  lotId?: string | undefined;
  form: UseFormReturn<AdminLotFormValues>;
  formSchema: zod.ZodType<AdminLotFormValues>;
  lotStepFields: (keyof AdminLotFormValues)[][];
  editTabFields: Record<string, (keyof AdminLotFormValues)[]>;
  wizardGoTo: (index: number) => void;
  tabGoTo: (tab: string) => void;
  createIdempotencyKey: string;
  clearDraft: () => void;
  onValidationBanner: (message: string | null, stepIndex?: number) => void;
  router: { push: (href: string) => void; refresh: () => void };
};

export async function validateAllLotWizardSteps(
  form: UseFormReturn<AdminLotFormValues>,
  formSchema: zod.ZodType<AdminLotFormValues>,
  lotStepFields: (keyof AdminLotFormValues)[][],
  wizardGoTo: (index: number) => void,
): Promise<boolean> {
  for (let i = 0; i < lotStepFields.length; i++) {
    const fields = lotStepFields[i];
    if (fields?.length && !(await validateWizardStep(form, formSchema, fields))) {
      wizardGoTo(i);
      return false;
    }
  }
  return true;
}

export function reportLotFormValidationFailure(
  form: UseFormReturn<AdminLotFormValues>,
  issues: zod.ZodIssue[],
  args: Pick<
    SubmitArgs,
    "mode" | "lotStepFields" | "editTabFields" | "wizardGoTo" | "tabGoTo" | "onValidationBanner"
  >,
): void {
  if (args.mode === "create") {
    applyZodIssuesToForm(form, issues, {
      stepFields: args.lotStepFields,
      goTo: args.wizardGoTo,
    });
    const stepIndex = issues[0]?.path[0]
      ? args.lotStepFields.findIndex((fields) =>
          fields.some((f) => String(f) === String(issues[0]?.path[0])),
        )
      : -1;
    if (stepIndex >= 0) {
      args.onValidationBanner(
        lotFormValidationBanner(issues.length, lotFormStepLabel(stepIndex)),
        stepIndex,
      );
    } else {
      args.onValidationBanner(null);
    }
  } else {
    applyZodIssuesToForm(form, issues, {
      tabFields: args.editTabFields,
      goToTab: args.tabGoTo,
    });
    args.onValidationBanner(null);
  }
  notifyAdminFormValidationFailure({ issues });
}

export async function submitLotForm(values: AdminLotFormValues, args: SubmitArgs): Promise<void> {
  args.onValidationBanner(null);
  args.form.clearErrors("root");

  if (args.mode === "create") {
    const api = safeParseCreateLotFromForm(values);
    if (!api.success) {
      reportLotFormValidationFailure(args.form, api.error.issues, args);
      return;
    }
    const r = await adminCreateLotResultAction(api.data, args.createIdempotencyKey);
    if (r.ok) {
      args.clearDraft();
      const newId = r.data?.id;
      if (newId) {
        const alts = await adminUpdateLotMarketingDetailsResultAction(
          newId,
          formValuesToImageAltsPatch(values),
        );
        if (!alts.ok) {
          notify.warning("Draft created, but image alt text could not be saved", {
            description: alts.error,
          });
        }
      }
      if (newId) {
        notify.action("Draft lot created", {
          description: "Add photos and finish catalogue details before publishing.",
          actionLabel: "Add images",
          onAction: () => args.router.push(`/admin/lots/${newId}/images`),
        });
        args.router.push(`/admin/lots/${newId}?created=1`);
      } else {
        notify.warning("Draft created but id was missing — open it from the lots list.");
        args.router.push("/admin/lots");
      }
      return;
    }
    notify.error(
      actionFailureNotifyMessage(r.error, {
        status: r.status,
        errorCode: r.errorCode,
        meta: r.meta,
      }),
    );
    return;
  }

  if (!args.lotId) {
    notify.error("Missing lot");
    return;
  }
  const api = safeParseUpdateLotFromForm(values);
  if (!api.success) {
    reportLotFormValidationFailure(args.form, api.error.issues, args);
    return;
  }
  const r = await adminUpdateLotResultAction(args.lotId, api.data);
  if (r.ok) {
    args.clearDraft();
    const alts = await adminUpdateLotMarketingDetailsResultAction(
      args.lotId,
      formValuesToImageAltsPatch(values),
    );
    if (!alts.ok) {
      notify.warning("Lot saved, but image alt text could not be saved", {
        description: alts.error,
      });
    } else {
      notify.success("Saved");
    }
    args.router.refresh();
    args.router.push(`/admin/lots/${args.lotId}`);
    return;
  }
  notify.error(
    actionFailureNotifyMessage(r.error, {
      status: r.status,
      errorCode: r.errorCode,
      meta: r.meta,
    }),
  );
}
