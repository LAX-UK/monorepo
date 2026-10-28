"use client";

import {
  categoryDetailTabHref,
  categoryEditHref,
} from "@/components/admin/category-detail/category-detail-types";
import { useCategoryActions } from "@/components/admin/category-detail/use-category-actions";
import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { usePinPageAction } from "@/components/admin/staff/use-pin-page-action";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { useViewerCapabilities } from "@/lib/auth/capabilities/viewer-capabilities-context";
import { CATEGORIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  DetailPage,
  MetaItem,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  staffCellLinkClass,
} from "@auction/staff-ui";
import type { AdminCategory } from "@auction/types";
import { Pencil } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  categoryId: string;
  category: AdminCategory;
  children: ReactNode;
  directChildCount?: number | null;
  descendantCount?: number | null;
  lotCount?: number | null;
  saleCount?: number | null;
  parentName?: string | null;
};

/**
 * A category's page on the staff record template: the name, whether it is in use or
 * archived, where it sits in the tree, Edit as the one primary action, archive and delete in the
 * overflow menu, and its sections as tabs.
 */
export function CategoryDetailShell({
  categoryId,
  category,
  children,
  directChildCount = null,
  descendantCount = null,
  lotCount = null,
  saleCount = null,
  parentName = null,
}: Props) {
  const status = staffStatus("category", category.archived ? "archived" : "active");
  const pin = usePinPageAction(category.name);
  const actions = useCategoryActions(category);
  const canManage = useViewerCapabilities().can(CATEGORIES_ACCESS);
  const nested = descendantCount ?? directChildCount ?? 0;
  const lots = lotCount ?? category.usage.lots;
  const sales = saleCount ?? category.usage.sales;

  const overflow: OverflowAction[] = [pin, ...actions.items];

  const tabs = [
    { id: "overview", label: "Overview", href: categoryDetailTabHref(categoryId, "overview") },
    {
      id: "children",
      label: "Subcategories",
      href: categoryDetailTabHref(categoryId, "children"),
      count: nested,
    },
    { id: "lots", label: "Lots", href: categoryDetailTabHref(categoryId, "lots"), count: lots },
    { id: "sales", label: "Sales", href: categoryDetailTabHref(categoryId, "sales"), count: sales },
    { id: "activity", label: "Activity", href: categoryDetailTabHref(categoryId, "activity") },
  ];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[
              { label: "Categories", href: "/admin/categories" },
              ...(category.parentId && parentName
                ? [{ label: parentName, href: `/admin/categories/${category.parentId}` }]
                : []),
              { label: category.name },
            ]}
          />
        }
        title={category.name}
        access={canManage ? "full" : "read-only"}
        status={
          <StatusBadge tone={status.tone} live={status.live ?? false}>
            {status.label}
          </StatusBadge>
        }
        meta={
          <>
            <MetaItem label="Web address">
              <span className="font-mono">/{category.slug}</span>
            </MetaItem>
            <MetaItem label="Parent">
              {category.parentId && parentName ? (
                <Link
                  href={`/admin/categories/${category.parentId}`}
                  className={staffCellLinkClass}
                >
                  {parentName}
                </Link>
              ) : (
                "Top level"
              )}
            </MetaItem>
          </>
        }
        primaryAction={
          <StaffButton asChild variant="primary" icon={<Pencil aria-hidden />}>
            <Link href={categoryEditHref(categoryId)}>Edit category</Link>
          </StaffButton>
        }
        overflow={<OverflowMenu label="More category actions" Link={NextLink} actions={overflow} />}
        tabs={<StaffDetailTabs label="Category sections" items={tabs} />}
      >
        {children}
      </DetailPage>
      {actions.dialogs}
    </>
  );
}
