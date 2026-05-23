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
  continueLabel?: string;
};

/** Mobile action bar for multi-step wizards — Continue until the final step, then submit. */
export function CatalogWizardMobileActions({
  formId,
  submitLabel,
  cancelHref,
  continueLabel = "Continue",
}: Props) {
  const { active, isLast, pending } = useWizardStepSync();

  if (!active) return null;

  return (
    <CatalogMobileActionBar
      actions={[
        isLast
          ? {
              id: "save",
              label: submitLabel,
              variant: "primary",
              htmlForm: formId,
              disabled: pending,
            }
          : {
              id: "continue",
              label: continueLabel,
              variant: "primary",
              disabled: pending,
              onClick: () => invokeWizardNext(),
            },
        {
          id: "cancel",
          label: "Cancel",
          variant: "secondary",
          href: cancelHref,
        },
      ]}
    />
  );
}
