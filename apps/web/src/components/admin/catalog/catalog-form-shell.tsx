import { AppScreen } from "@/components/dashboard/dashboard-page";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { type CatalogMobileAction, CatalogMobileActionBar } from "./catalog-mobile-action-bar";
import { CatalogPageHeader } from "./catalog-page-header";
import { CatalogWizardMobileActions } from "./catalog-wizard-mobile-actions";

type Props = {
  title: ReactNode;
  description?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  mobileActions?: readonly CatalogMobileAction[];
  /** Wizard create flows — submit stays disabled until the final step. */
  wizardMobile?: {
    formId: string;
    submitLabel: string;
    cancelHref: string;
  };
  children: ReactNode;
  className?: string;
};

/** Create/edit pages — single column mobile, optional desktop actions in header. */
export function CatalogFormShell({
  title,
  description,
  breadcrumbs,
  actions,
  mobileActions,
  wizardMobile,
  children,
  className,
}: Props) {
  const showMobileBar = Boolean(
    (mobileActions && mobileActions.length > 0) || wizardMobile != null,
  );

  return (
    <AppScreen
      className={cn(
        "mx-auto w-full max-w-3xl space-y-6 md:max-w-4xl md:space-y-8 md:pb-8",
        showMobileBar ? "pb-28" : "pb-8",
        className,
      )}
    >
      <CatalogPageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        actions={actions}
        mobileActionsPlacement="none"
      />
      <div className="min-w-0">{children}</div>
      {wizardMobile ? (
        <CatalogWizardMobileActions
          formId={wizardMobile.formId}
          submitLabel={wizardMobile.submitLabel}
          cancelHref={wizardMobile.cancelHref}
        />
      ) : showMobileBar ? (
        <CatalogMobileActionBar actions={mobileActions ?? []} />
      ) : null}
    </AppScreen>
  );
}
