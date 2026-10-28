"use client";

import {
  type SaleDetailNavGroup,
  resolveSaleDetailNav,
} from "@/lib/admin/sales/build-sale-detail-nav";
import { parseSaleDetailTabFromPath } from "@/lib/admin/sales/sale-detail-routes";
import { SecondaryTabNav, type StaffLinkComponent, TabNav } from "@auction/staff-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NextLink: StaffLinkComponent = Link;

/**
 * The sale's tabs by job, with the current group's pages under them. Both follow the URL, so the
 * nav lives in the shared layout and stays mounted while staff move between pages.
 */
export function SaleDetailSectionNav({
  saleId,
  groups,
}: {
  saleId: string;
  groups: readonly SaleDetailNavGroup[];
}) {
  const pathname = usePathname() ?? "";
  const { group, pages, pageId } = resolveSaleDetailNav(
    groups,
    parseSaleDetailTabFromPath(pathname, saleId),
  );
  return (
    <div className="flex flex-col gap-4">
      <TabNav items={groups} activeId={group?.id ?? ""} label="Sale sections" Link={NextLink} />
      {group && pages.length > 0 ? (
        <SecondaryTabNav items={pages} activeId={pageId} label={group.label} Link={NextLink} />
      ) : null}
    </div>
  );
}
