"use client";

import {
  type CatalogFormSection,
  CatalogFormSectionNav,
} from "@/components/admin/catalog/catalog-form-section-nav";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import type { CatalogMobileAction } from "@/components/admin/catalog/catalog-mobile-action-bar";
import {
  LotEditFormProvider,
  useLotEditFormContext,
} from "@/components/admin/lot-form/lot-edit-form-context";
import {
  type LotEditSection,
  lotEditSectionHref,
  parseLotEditSectionFromPath,
} from "@/components/admin/lot-form/lot-edit-types";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useMemo } from "react";

type Props = {
  lotId: string;
  canEditCore: boolean;
  title: ReactNode;
  description?: string;
  breadcrumbs: ReactNode;
  auctionSection?: ReactNode;
  catalogSection: ReactNode;
  documentsSection: ReactNode;
};

export function LotEditFormLayout(props: Props) {
  return <LotEditFormLayoutInner {...props} />;
}

function LotEditFormLayoutInner({
  lotId,
  canEditCore,
  title,
  description,
  breadcrumbs,
  auctionSection,
  catalogSection,
  documentsSection,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const cancelHref = `/admin/lots/${lotId}`;
  const activeSection = parseLotEditSectionFromPath(pathname, lotId, canEditCore);

  const sections = useMemo((): CatalogFormSection[] => {
    const items: CatalogFormSection[] = [];
    if (canEditCore) {
      items.push({ id: "auction", label: "Auction setup" });
    }
    items.push({ id: "catalog", label: "Catalog copy" });
    items.push({ id: "documents", label: "Documents" });
    return items;
  }, [canEditCore]);

  const navigateToSection = useCallback(
    (section: LotEditSection) => {
      router.push(lotEditSectionHref(lotId, section, canEditCore));
    },
    [canEditCore, lotId, router],
  );

  return (
    <LotEditFormProvider activeSection={activeSection}>
      <LotEditFormLayoutBody
        lotId={lotId}
        canEditCore={canEditCore}
        title={title}
        {...(description ? { description } : {})}
        breadcrumbs={breadcrumbs}
        auctionSection={auctionSection}
        catalogSection={catalogSection}
        documentsSection={documentsSection}
        sections={sections}
        activeSection={activeSection}
        navigateToSection={navigateToSection}
        cancelHref={cancelHref}
      />
    </LotEditFormProvider>
  );
}

type BodyProps = Props & {
  sections: CatalogFormSection[];
  activeSection: LotEditSection;
  navigateToSection: (section: LotEditSection) => void;
  cancelHref: string;
};

function LotEditFormLayoutBody({
  canEditCore,
  title,
  description,
  breadcrumbs,
  auctionSection,
  catalogSection,
  documentsSection,
  sections,
  activeSection,
  navigateToSection,
  cancelHref,
}: BodyProps) {
  const lotEditCtx = useLotEditFormContext();

  const handleSectionChange = useCallback(
    (sectionId: string) => {
      void (async () => {
        const next = sectionId as LotEditSection;
        if (next === activeSection) return;
        if (lotEditCtx && !(await lotEditCtx.confirmLeaveActiveSection())) return;
        navigateToSection(next);
      })();
    },
    [activeSection, lotEditCtx, navigateToSection],
  );

  const saveConfig = useMemo(() => {
    if (activeSection === "auction" && canEditCore) {
      return { formId: CATALOG_FORM_IDS.lot, label: "Save changes" };
    }
    if (activeSection === "catalog") {
      return {
        formId: CATALOG_FORM_IDS.lotMarketing,
        label: "Save catalog copy",
      };
    }
    return null;
  }, [activeSection, canEditCore]);

  const mobileActions = useMemo((): CatalogMobileAction[] => {
    const actions: CatalogMobileAction[] = [];
    if (saveConfig) {
      actions.push({
        id: "save",
        label: saveConfig.label,
        variant: "primary",
        htmlForm: saveConfig.formId,
      });
    }
    actions.push({
      id: "cancel",
      label: "Cancel",
      variant: saveConfig ? "secondary" : "primary",
      href: cancelHref,
    });
    return actions;
  }, [cancelHref, saveConfig]);

  const desktopActions = saveConfig ? (
    <Button type="submit" form={saveConfig.formId} variant="default">
      {saveConfig.label}
    </Button>
  ) : null;

  return (
    <CatalogFormShell
      breadcrumbs={breadcrumbs}
      title={title}
      {...(description ? { description } : {})}
      actions={desktopActions}
      mobileActions={mobileActions}
    >
      <div className="space-y-6">
        <CatalogFormSectionNav
          sections={sections}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          aria-label="Edit sections"
        />
        {canEditCore && auctionSection ? (
          <section
            className={cn("space-y-4", activeSection !== "auction" && "hidden")}
            aria-hidden={activeSection !== "auction"}
          >
            <div>
              <h2 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                Auction setup
              </h2>
              <p className="mt-1 font-body text-sm text-on-surface-variant">
                Sale assignment, pricing, and schedule. Saved with Save changes — not the catalog
                copy section.
              </p>
            </div>
            {auctionSection}
          </section>
        ) : null}
        <section
          className={cn("space-y-4", activeSection !== "catalog" && "hidden")}
          aria-hidden={activeSection !== "catalog"}
        >
          {!canEditCore ? (
            <p className="font-body text-sm text-on-surface-variant">
              Core auction fields are locked while the lot is live. Update estimate, condition,
              provenance, and artist note here.
            </p>
          ) : null}
          {catalogSection}
        </section>
        <section
          className={cn("space-y-4", activeSection !== "documents" && "hidden")}
          aria-hidden={activeSection !== "documents"}
        >
          {documentsSection}
        </section>
      </div>
    </CatalogFormShell>
  );
}
