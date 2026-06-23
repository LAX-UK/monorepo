"use client";

import { validateAllCatalogWizardSteps } from "@/components/admin/catalog/use-catalog-form-submit";
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
  /** When creating into a non-draft sale, copy and navigation reflect emergency add. */
  emergencyAddSaleStatus?: "scheduled" | "active" | null;
};

export async function validateAllLotWizardSteps(
  form: UseFormReturn<AdminLotFormValues>,
  formSchema: zod.ZodType<AdminLotFormValues>,
  lotStepFields: (keyof AdminLotFormValues)[][],
  wizardGoTo: (index: number) => void,
): Promise<boolean> {
  return validateAllCatalogWizardSteps(form, formSchema, lotStepFields, wizardGoTo);
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
      const isEmergencyAdd =
        args.emergencyAddSaleStatus === "scheduled" || args.emergencyAddSaleStatus === "active";
      if (newId) {
        const alts = await adminUpdateLotMarketingDetailsResultAction(
          newId,
          formValuesToImageAltsPatch(values),
        );
        if (!alts.ok) {
          notify.warning(
            isEmergencyAdd
              ? "Lot added but alt text could not be saved"
              : "Draft created, but image alt text could not be saved",
            { description: alts.error },
          );
        }
      }
      if (newId) {
        if (isEmergencyAdd) {
          notify.success(
            args.emergencyAddSaleStatus === "active"
              ? "Lot added to live sale"
              : "Lot added and scheduled",
            {
              description: "The lot is ready for the clerk or online timer.",
            },
          );
          args.router.push(`/admin/lots/${newId}?created=1`);
        } else {
          notify.action("Draft lot created", {
            description: "Add photos and finish catalogue details before publishing.",
            actionLabel: "Add images",
            onAction: () => args.router.push(`/admin/lots/${newId}/images`),
          });
          args.router.push(`/admin/lots/${newId}?created=1`);
        }
      } else {
        notify.warning("Lot created but id was missing — open it from the lots list.");
        args.router.push("/admin/lots");
      }
      return;
    }
    const lotId = typeof r.meta?.lotId === "string" ? r.meta.lotId : null;
    const rolledBack = r.meta?.rolledBack === true;
    notify.error(
      actionFailureNotifyMessage(r.error, {
        status: r.status,
        errorCode: r.errorCode,
        meta: r.meta,
      }),
      rolledBack && lotId
        ? {
            description:
              "Saved as standalone inventory. Open the lot to fix catalogue details and retry.",
          }
        : undefined,
    );
    if (rolledBack && lotId) {
      args.router.push(`/admin/lots/${lotId}`);
    }
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
