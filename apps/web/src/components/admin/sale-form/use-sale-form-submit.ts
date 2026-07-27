"use client";

import { validateAllCatalogWizardSteps } from "@/components/admin/catalog/use-catalog-form-submit";
import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import { saleFormStepLabel, saleFormValidationBanner } from "@/lib/admin/sale-form-step-copy";
import {
  findPersistBlockingLotWindowConflicts,
  parseSaleWindowFromForm,
} from "@/lib/admin/sale-lot-window-sync";
import { scheduleLotConflictPersistBlocked } from "@/lib/admin/sale-setup/field-copy";
import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import { SALE_FORM_WIZARD_STEP_FIELDS } from "@/lib/admin/sale-setup/steps";
import {
  applyZodErrorsToForm,
  zodIssuePathForForm as zodPathJoin,
} from "@/lib/admin/zod-form-errors";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import {
  type AdminSaleFormValues,
  safeParseUpdatePublishedSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { Lot } from "@auction/types";
import type { RefObject } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { z as zod } from "zod";
import type { StreamUrlVerificationGate } from "./stream-url-verify-control";

export const SALE_STEP_FIELDS = SALE_FORM_WIZARD_STEP_FIELDS.map((fields) => [
  ...fields,
]) as (keyof AdminSaleFormValues)[][];

function saleZodIssuePath(path: (string | number)[]): string {
  if (path.length > 0 && typeof path[0] === "number") {
    return zodPathJoin(["buyerPremiumTiers", ...path]);
  }
  return zodPathJoin(path);
}

function saleStepIndexForIssue(issues: { path: (string | number)[] }[]): number {
  const head = issues[0]?.path[0];
  if (head == null) return -1;
  if (typeof head === "number") {
    return SALE_STEP_FIELDS.findIndex((fields) => fields.includes("buyerPremiumTiers"));
  }
  return SALE_STEP_FIELDS.findIndex((fields) => fields.some((f) => String(f) === String(head)));
}

type SubmitArgs = {
  saleId: string;
  isDraft: boolean;
  lots: Lot[];
  form: UseFormReturn<AdminSaleFormValues>;
  formSchema: zod.ZodType<AdminSaleFormValues>;
  wizardGoTo: (index: number) => void;
  onSaveNotice: (message: string | null) => void;
  onValidationBanner?: (message: string | null, stepIndex?: number) => void;
  router: { push: (href: string) => void };
  streamUrlGateRef?: RefObject<StreamUrlVerificationGate | null>;
};

export async function validateAllSaleWizardSteps(
  form: UseFormReturn<AdminSaleFormValues>,
  formSchema: Parameters<typeof validateAllCatalogWizardSteps>[1],
  wizardGoTo: (index: number) => void,
): Promise<boolean> {
  return validateAllCatalogWizardSteps(
    form as unknown as UseFormReturn<FieldValues>,
    formSchema,
    SALE_STEP_FIELDS,
    wizardGoTo,
  );
}

export function reportSaleFormZodFailure(
  form: UseFormReturn<AdminSaleFormValues>,
  issues: { path: (string | number)[]; message: string }[],
  args: Pick<SubmitArgs, "wizardGoTo" | "onValidationBanner">,
): void {
  for (const iss of issues) {
    applyZodErrorsToForm(form, saleZodIssuePath([...iss.path]), iss.message);
  }
  const stepIndex = saleStepIndexForIssue(issues);
  if (stepIndex >= 0) {
    args.onValidationBanner?.(
      saleFormValidationBanner(issues.length, saleFormStepLabel(stepIndex)),
      stepIndex,
    );
  } else {
    args.onValidationBanner?.(null);
  }
  notifyAdminFormValidationFailure({ issues });
  if (stepIndex >= 0) {
    args.wizardGoTo(stepIndex);
  }
}

export async function submitSaleForm(values: AdminSaleFormValues, args: SubmitArgs): Promise<void> {
  args.form.clearErrors("root");
  args.onSaveNotice(null);
  args.onValidationBanner?.(null);

  const api = args.isDraft
    ? safeParseUpdateSaleFromForm(values)
    : safeParseUpdatePublishedSaleFromForm(values);
  if (!api.success) {
    reportSaleFormZodFailure(args.form, api.error.issues, args);
    return;
  }
  const streamBlockMsg = args.streamUrlGateRef?.current?.assertCanSubmit(values.streamUrl);
  if (streamBlockMsg) {
    args.form.setError("streamUrl", { type: "manual", message: streamBlockMsg });
    args.onValidationBanner?.(streamBlockMsg, 1);
    args.wizardGoTo(1);
    notifyAdminFormValidationFailure({});
    return;
  }
  if (args.isDraft && args.lots.length > 0) {
    const pendingWindow = parseSaleWindowFromForm(values);
    if (pendingWindow) {
      const conflicts = findPersistBlockingLotWindowConflicts(args.lots, pendingWindow);
      if (conflicts.length > 0) {
        const titles = conflicts.map((c) => c.lot.title.trim() || "Untitled lot");
        args.onSaveNotice(scheduleLotConflictPersistBlocked(titles));
        args.wizardGoTo(1);
        return;
      }
    }
  }
  const r = await adminUpdateSaleResultAction(args.saleId, api.data);
  if (r.ok) {
    notify.success("Saved");
    args.router.push(`/admin/sales/${args.saleId}`);
    return;
  }
  notify.error(
    humanizeSetupError({
      message: actionFailureNotifyMessage(r.error, {
        status: r.status,
        errorCode: r.errorCode,
        meta: r.meta,
      }),
      errorCode: r.errorCode,
    }),
  );
  if (r.fieldErrors) {
    applyActionFieldErrors(args.form, r.fieldErrors, {
      stepFields: SALE_STEP_FIELDS,
      goTo: args.wizardGoTo,
    });
  }
}
