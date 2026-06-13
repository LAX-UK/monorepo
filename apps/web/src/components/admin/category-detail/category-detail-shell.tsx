import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailStickyMiniBar,
  CatalogDetailTabNav,
  type CatalogMobileAction,
  CatalogPostCreateSessionRoot,
  CatalogWhatsNextBanner,
} from "@/components/admin/catalog";
import { CategoryContextRail } from "@/components/admin/category-detail/category-context-rail";
import {
  categoryDetailTabHref,
  categoryEditHref,
} from "@/components/admin/category-detail/category-detail-types";
import { buildCategoryTaxonomyReadiness } from "@/lib/admin/catalog-readiness";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";
import { Button } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = {
  categoryId: string;
  category: AdminCategory;
  children: ReactNode;
  directChildCount?: number | null;
  descendantCount?: number | null;
  lotCount?: number | null;
  saleCount?: number | null;
  activityEvents?: readonly AdminDomainEventRow[];
  parentName?: string | null;
};

export function CategoryDetailShell({
  categoryId,
  category,
  children,
  directChildCount = null,
  descendantCount = null,
  lotCount = null,
  saleCount = null,
  activityEvents = [],
  parentName = null,
}: Props) {
  const archivedStatusBadge = (
    <AdminStatusBadge domain="category" status={category.archived ? "archived" : "active"} />
  );

  const mobileActions: CatalogMobileAction[] = [
    {
      id: "edit-category",
      label: "Edit",
      href: categoryEditHref(categoryId),
      variant: "primary",
    },
  ];

  const resolvedDirectChildren = directChildCount ?? 0;
  const resolvedSales = saleCount ?? category.usage.sales;

  const tabSpecs = [
    { id: "overview", label: "Overview", href: categoryDetailTabHref(categoryId, "overview") },
    {
      id: "children",
      label: `Descendants${descendantCount != null && descendantCount > 0 ? ` (${descendantCount})` : ""}`,
      href: categoryDetailTabHref(categoryId, "children"),
    },
    {
      id: "lots",
      label: `Lots${lotCount != null && lotCount > 0 ? ` (${lotCount})` : ""}`,
      href: categoryDetailTabHref(categoryId, "lots"),
    },
    {
      id: "sales",
      label: `Sales${resolvedSales > 0 ? ` (${resolvedSales})` : ""}`,
      href: categoryDetailTabHref(categoryId, "sales"),
    },
    {
      id: "activity",
      label: "Activity",
      href: categoryDetailTabHref(categoryId, "activity"),
    },
  ];

  const taxonomyReadiness = buildCategoryTaxonomyReadiness(
    categoryId,
    category,
    resolvedDirectChildren,
  );

  return (
    <CatalogPostCreateSessionRoot>
      <CatalogDetailShell
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[
              { label: "Categories", href: "/admin/categories" },
              { label: category.name },
            ]}
          />
        }
        eyebrow="Category"
        title={category.name}
        description={category.description ?? undefined}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {archivedStatusBadge}
            <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              /{category.slug}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPinPageButton label={category.name} />
            <Button variant="outline" size="sm" asChild>
              <Link href={categoryEditHref(categoryId)}>Edit</Link>
            </Button>
          </div>
        }
        mobileActions={mobileActions}
        mobileMeta={
          <CatalogDetailMobileMeta
            entityId={categoryId}
            updatedAt={category.updatedAt}
            status={archivedStatusBadge}
            quickLinks={[
              ...(category.parentId
                ? [
                    {
                      label: parentName ? `Parent: ${parentName}` : "Parent",
                      href: `/admin/categories/${category.parentId}`,
                    },
                  ]
                : []),
            ]}
            primaryAction={
              <Link
                href={categoryEditHref(categoryId)}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
              >
                Edit category →
              </Link>
            }
          />
        }
        aside={
          <CategoryContextRail
            categoryId={categoryId}
            category={category}
            directChildCount={resolvedDirectChildren}
            status={archivedStatusBadge}
            activityEvents={activityEvents}
            parentName={parentName}
          />
        }
        stickySubnav={
          <>
            <CatalogDetailTabNav
              tabs={tabSpecs}
              entityKind="category"
              entityId={categoryId}
              aria-label="Category sections"
            />
            <CatalogDetailStickyMiniBar
              items={[
                {
                  id: "children",
                  label: "Direct children",
                  value: String(resolvedDirectChildren),
                },
                {
                  id: "lots",
                  label: "Lots",
                  value: String(lotCount ?? category.usage.lots),
                },
                {
                  id: "sales",
                  label: "Sales",
                  value: String(resolvedSales),
                },
                {
                  id: "submissions",
                  label: "Submissions",
                  value: String(category.usage.submissions),
                },
              ]}
            />
          </>
        }
      >
        <Suspense fallback={null}>
          <CatalogWhatsNextBanner
            entityLabel="category"
            readiness={taxonomyReadiness}
            dismissKey={`category:${categoryId}`}
          />
        </Suspense>
        {children}
      </CatalogDetailShell>
    </CatalogPostCreateSessionRoot>
  );
}
