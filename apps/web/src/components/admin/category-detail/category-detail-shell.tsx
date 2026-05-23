import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogDetailShell,
  CatalogDetailTabNav,
  CatalogInfoAside,
  type CatalogMobileAction,
} from "@/components/admin/catalog";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import type { AdminCategory } from "@auction/types";
import { Button } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  categoryId: string;
  category: AdminCategory;
  children: ReactNode;
  childCount?: number | null;
  lotCount?: number | null;
};

export function CategoryDetailShell({
  categoryId,
  category,
  children,
  childCount = null,
  lotCount = null,
}: Props) {
  const archivedStatusBadge = (
    <AdminStatusBadge domain="category" status={category.archived ? "archived" : "active"} />
  );

  const mobileActions: CatalogMobileAction[] = [
    {
      id: "edit-category",
      label: "Edit",
      href: categoryDetailTabHref(categoryId, "edit"),
      variant: "primary",
    },
  ];

  const tabSpecs = [
    { id: "overview", label: "Overview", href: categoryDetailTabHref(categoryId, "overview") },
    { id: "edit", label: "Edit", href: categoryDetailTabHref(categoryId, "edit") },
    {
      id: "children",
      label: `Children${childCount != null && childCount > 0 ? ` (${childCount})` : ""}`,
      href: categoryDetailTabHref(categoryId, "children"),
    },
    {
      id: "lots",
      label: `Lots${lotCount != null && lotCount > 0 ? ` (${lotCount})` : ""}`,
      href: categoryDetailTabHref(categoryId, "lots"),
    },
  ];

  return (
    <CatalogDetailShell
      breadcrumbs={
        <Link href="/admin/categories" className="text-primary hover:underline">
          ← Categories
        </Link>
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
        <Button variant="outline" size="sm" asChild>
          <Link href={categoryDetailTabHref(categoryId, "edit")}>Edit</Link>
        </Button>
      }
      mobileActions={mobileActions}
      aside={<CatalogInfoAside entityId={categoryId} status={archivedStatusBadge} />}
      tabs={
        <div className="space-y-6">
          <CatalogDetailTabNav
            tabs={tabSpecs}
            entityKind="category"
            entityId={categoryId}
            aria-label="Category sections"
          />
          <div>{children}</div>
        </div>
      }
    >
      {null}
    </CatalogDetailShell>
  );
}
