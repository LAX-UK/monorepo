import { CatalogInfoCard } from "@/components/admin/catalog";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import type { AdminCategory } from "@auction/types";
import Link from "next/link";

type Props = {
  categoryId: string;
  category: AdminCategory;
};

export function CategoryOverviewTab({ categoryId, category }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CatalogInfoCard title="Slug">
        <span className="font-mono text-sm">/{category.slug}</span>
      </CatalogInfoCard>
      <CatalogInfoCard title="Sort order">
        <span className="tabular-nums">{category.sortOrder}</span>
      </CatalogInfoCard>
      <CatalogInfoCard title="Parent chain" className="sm:col-span-2">
        {!category.parentId ? (
          <span className="text-on-surface-variant">Root category</span>
        ) : (
          <p className="font-body text-sm text-on-surface-variant">
            Parent:{" "}
            <Link
              href={`/admin/categories/${category.parentId}`}
              className="text-primary hover:underline"
            >
              Open parent category
            </Link>
          </p>
        )}
      </CatalogInfoCard>
      <CatalogInfoCard title="Child categories">
        <Link
          href={categoryDetailTabHref(categoryId, "children")}
          className="text-sm text-primary hover:underline"
        >
          View child categories
        </Link>
      </CatalogInfoCard>
      <CatalogInfoCard title="Usage">
        <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
          <li>{category.usage.lots} lots</li>
          <li>{category.usage.sales} sales</li>
          <li>{category.usage.submissions} submissions</li>
        </ul>
      </CatalogInfoCard>
      <CatalogInfoCard title="Hero image">
        {category.heroImageKey ? (
          <div className="space-y-2">
            <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Has hero
            </p>
            <p className="break-all font-mono text-xs text-on-surface-variant">
              {category.heroImageKey}
            </p>
          </div>
        ) : (
          <span className="text-on-surface-variant">No hero image</span>
        )}
      </CatalogInfoCard>
    </div>
  );
}
