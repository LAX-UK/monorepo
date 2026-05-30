"use client";

import {
  invokeWizardNext,
  useWizardStepSync,
} from "@/components/admin/admin-form-wizard/wizard-step-sync";
import { CatalogMobileActionBar } from "./catalog-mobile-action-bar";

type Props = {
  formId: string;
  submitLabel: string;
  cancelHref: string;
  cancelLabel?: string;
  continueLabel?: string;
  /** When true, Save is always available (edit flows). Continue still shown until last step. */
  alwaysShowSubmit?: boolean;
};

/** Mobile action bar for multi-step wizards — Continue until the final step, then submit. */
export function CatalogWizardMobileActions({
  formId,
  submitLabel,
  cancelHref,
  cancelLabel = "Cancel",
  continueLabel = "Continue",
  alwaysShowSubmit = false,
}: Props) {
  const { active, isLast, pending, primaryAction, cancelAction } = useWizardStepSync();

  if (!active) return null;

  const actions = [];
  if (alwaysShowSubmit || isLast) {
    if (primaryAction) {
      actions.push({
        id: "save",
        label: primaryAction.label,
        variant: "primary" as const,
        onClick: primaryAction.onClick,
        ...(primaryAction.disabled || pending ? { disabled: true } : {}),
      });
    } else {
      actions.push({
        id: "save",
        label: submitLabel,
        variant: "primary" as const,
        htmlForm: formId,
        disabled: pending,
      });
    }
  }
  if (!isLast) {
    actions.push({
      id: "continue",
      label: continueLabel,
      variant: (alwaysShowSubmit ? "secondary" : "primary") as "primary" | "secondary",
      disabled: pending,
      onClick: () => invokeWizardNext(),
    });
  }
  if (cancelAction) {
    if ("href" in cancelAction) {
      actions.push({
        id: "cancel",
        label: cancelAction.label,
        variant: "secondary" as const,
        href: cancelAction.href,
      });
    } else {
      actions.push({
        id: "cancel",
        label: cancelAction.label,
        variant: "secondary" as const,
        onClick: cancelAction.onClick,
        disabled: pending,
      });
    }
  } else {
    actions.push({
      id: "cancel",
      label: cancelLabel,
      variant: "secondary" as const,
      href: cancelHref,
    });
  }

  return <CatalogMobileActionBar actions={actions} />;
}
