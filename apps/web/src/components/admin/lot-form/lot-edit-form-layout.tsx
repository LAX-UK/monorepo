"use client";

import { LotEditFormProvider } from "@/components/admin/lot-form/lot-edit-form-context";
import {
  type LotEditSection,
  lotEditSectionHref,
  parseLotEditSectionFromPath,
} from "@/components/admin/lot-form/lot-edit-types";
import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { FormPage } from "@auction/staff-ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  lotId: string;
  canEditCore: boolean;
  title: ReactNode;
  description?: string;
  breadcrumbs: ReactNode;
  /** Above the form, e.g. that the lot's sale sells on ATG. */
  notice?: ReactNode;
  auctionSection?: ReactNode;
  catalogSection: ReactNode;
  documentsSection: ReactNode;
};

const SECTION_LABELS: Record<LotEditSection, string> = {
  auction: "Auction setup",
  catalog: "Catalogue copy",
  documents: "Documents",
};

/**
 * Editing a lot, one section at a time, each saved on its own: auction setup (while the lot is
 * not live), catalogue copy and documents. Switching section with unsaved changes asks first.
 */
export function LotEditFormLayout({
  lotId,
  canEditCore,
  title,
  description,
  breadcrumbs,
  notice,
  auctionSection,
  catalogSection,
  documentsSection,
}: Props) {
  const pathname = usePathname() ?? "";
  const activeSection = parseLotEditSectionFromPath(pathname, lotId, canEditCore);
  const sections: LotEditSection[] = canEditCore
    ? ["auction", "catalog", "documents"]
    : ["catalog", "documents"];

  return (
    <LotEditFormProvider activeSection={activeSection}>
      <FormPage
        breadcrumbs={breadcrumbs}
        title={title}
        {...(description ? { description } : {})}
        notice={notice}
        tabs={
          <StaffDetailTabs
            label="Edit sections"
            items={sections.map((section) => ({
              id: section,
              label: SECTION_LABELS[section],
              href: lotEditSectionHref(lotId, section, canEditCore),
            }))}
          />
        }
      >
        {activeSection === "auction" && canEditCore ? auctionSection : null}
        {activeSection === "catalog" ? catalogSection : null}
        {activeSection === "documents" ? documentsSection : null}
      </FormPage>
    </LotEditFormProvider>
  );
}
