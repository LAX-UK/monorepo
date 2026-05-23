import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogDetailSection,
  CatalogDetailSummaryStrip,
  CatalogInfoCard,
  CatalogPublishReadiness,
} from "@/components/admin/catalog";
import { categoryAncestorsOf } from "@/components/admin/category-detail/category-detail-helpers";
import {
  categoryDetailTabHref,
  categoryEditHref,
  categorySubmissionsHref,
} from "@/components/admin/category-detail/category-detail-types";
import { CategoryUsagePanel } from "@/components/admin/category-detail/category-usage-panel";
import { MediaImage } from "@/components/ui/media-image";
import { buildCategorySummaryItems } from "@/lib/admin/build-category-summary-items";
import { buildCategoryTaxonomyReadiness } from "@/lib/admin/catalog-readiness";
import { lotStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import type { AdminCategory, ItemSubmission, Lot } from "@auction/types";
import Link from "next/link";

type Props = {
  categoryId: string;
  category: AdminCategory;
  allCategories: AdminCategory[];
  directChildCount: number;
  descendantCount: number;
  previewLots: Lot[];
  previewSales: AdminSaleListRow[];
  previewSubmissions: ItemSubmission[];
};

export function CategoryOverviewTab({
  categoryId,
  category,
  allCategories,
  directChildCount,
  descendantCount,
  previewLots,
  previewSales,
  previewSubmissions,
}: Props) {
  const summaryItems = buildCategorySummaryItems(
    categoryId,
    category,
    directChildCount,
    descendantCount,
  );
  const readiness = buildCategoryTaxonomyReadiness(categoryId, category, directChildCount);
  const ancestors = categoryAncestorsOf(categoryId, allCategories);
  const heroSrc = resolveMediaSrc(category.heroImageKey);

  return (
    <div className="space-y-8">
      {readiness.percent < 100 ? (
        <CatalogPublishReadiness
          title="Taxonomy readiness"
          readiness={readiness}
          dismissKey={`category-overview:${categoryId}`}
        />
      ) : null}

      <CatalogDetailSummaryStrip items={summaryItems} />

      <CatalogDetailSection
        title="Usage & lifecycle"
        description="Where this category appears across the catalogue."
      >
        <CategoryUsagePanel categoryId={categoryId} usage={category.usage} />
      </CatalogDetailSection>

      <CatalogDetailSection title="Presentation" description="Public-facing copy and imagery.">
        <div className="grid gap-4 sm:grid-cols-2">
          <CatalogInfoCard title="Description" className="sm:col-span-2">
            {category.description?.trim() ? (
              <p className="font-body text-sm text-on-surface">{category.description}</p>
            ) : (
              <p className="text-sm text-on-surface-variant">
                No description.{" "}
                <Link href={categoryEditHref(categoryId)} className="text-primary hover:underline">
                  Add one →
                </Link>
              </p>
            )}
          </CatalogInfoCard>
          <CatalogInfoCard title="Hero image" className="sm:col-span-2">
            {heroSrc ? (
              <div className="space-y-3">
                <MediaImage
                  src={heroSrc}
                  alt={`${category.name} hero`}
                  className="max-h-48 w-full max-w-md rounded-lg object-cover"
                />
                <Link
                  href={categoryEditHref(categoryId)}
                  className="font-label text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                >
                  Change hero →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">
                No hero image.{" "}
                <Link href={categoryEditHref(categoryId)} className="text-primary hover:underline">
                  Upload →
                </Link>
              </p>
            )}
          </CatalogInfoCard>
        </div>
      </CatalogDetailSection>

      <CatalogDetailSection title="Taxonomy" description="Hierarchy position and ordering.">
        <div className="grid gap-4 sm:grid-cols-2">
          <CatalogInfoCard title="Slug">
            <span className="font-mono text-sm">/{category.slug}</span>
          </CatalogInfoCard>
          <CatalogInfoCard title="Sort order">
            <span className="tabular-nums">{category.sortOrder}</span>
          </CatalogInfoCard>
          <CatalogInfoCard title="Status">
            <AdminStatusBadge
              domain="category"
              status={category.archived ? "archived" : "active"}
            />
          </CatalogInfoCard>
          <CatalogInfoCard title="Branch">
            <p className="text-sm text-on-surface">
              {directChildCount} direct {directChildCount === 1 ? "child" : "children"}
              {descendantCount > directChildCount ? (
                <span className="text-on-surface-variant"> · {descendantCount} descendants</span>
              ) : null}
            </p>
            <Link
              href={categoryDetailTabHref(categoryId, "children")}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              View descendants →
            </Link>
          </CatalogInfoCard>
          <CatalogInfoCard title="Parent chain" className="sm:col-span-2">
            {ancestors.length === 0 ? (
              <span className="text-on-surface-variant">Root category</span>
            ) : (
              <ol className="flex flex-wrap items-center gap-1 font-body text-sm text-on-surface-variant">
                {ancestors.map((ancestor, index) => (
                  <li key={ancestor.id} className="flex items-center gap-1">
                    {index > 0 ? <span aria-hidden>/</span> : null}
                    <Link
                      href={`/admin/categories/${ancestor.id}`}
                      className="text-primary hover:underline"
                    >
                      {ancestor.name}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CatalogInfoCard>
        </div>
      </CatalogDetailSection>

      {(previewLots.length > 0 || previewSales.length > 0 || previewSubmissions.length > 0) && (
        <CatalogDetailSection title="Recent links" description="Latest catalogue references.">
          <div className="grid gap-6 lg:grid-cols-3">
            {previewLots.length > 0 ? (
              <PreviewList
                title="Lots"
                viewAllHref={categoryDetailTabHref(categoryId, "lots")}
                items={previewLots.map((lot) => ({
                  id: lot.id,
                  label: lot.title,
                  meta: lotStatusLabel[lot.status] ?? lot.status,
                  href: `/admin/lots/${lot.id}`,
                }))}
              />
            ) : null}
            {previewSales.length > 0 ? (
              <PreviewList
                title="Sales"
                viewAllHref={categoryDetailTabHref(categoryId, "sales")}
                items={previewSales.map(({ sale, lots }) => ({
                  id: sale.id,
                  label: sale.title,
                  meta: `${lots.length} lots · ${sale.status}`,
                  href: `/admin/sales/${sale.id}`,
                }))}
              />
            ) : null}
            {previewSubmissions.length > 0 ? (
              <PreviewList
                title="Submissions"
                viewAllHref={categorySubmissionsHref(categoryId)}
                items={previewSubmissions.map((submission) => ({
                  id: submission.id,
                  label: submission.title,
                  meta: submission.status.replaceAll("_", " "),
                  href: `/admin/submissions/${submission.id}`,
                }))}
              />
            ) : null}
          </div>
        </CatalogDetailSection>
      )}
    </div>
  );
}

function PreviewList({
  title,
  viewAllHref,
  items,
}: {
  title: string;
  viewAllHref: string;
  items: { id: string; label: string; meta: string; href: string }[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-headline text-sm font-semibold text-on-surface">{title}</h4>
        <Link
          href={viewAllHref}
          className="font-label text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-outline-variant/15 rounded-lg border border-border-hairline">
        {items.map((item) => (
          <li key={item.id} className="px-3 py-2.5">
            <Link
              href={item.href}
              className="font-medium text-sm text-on-surface hover:text-primary"
            >
              {item.label}
            </Link>
            <p className="text-xs capitalize text-on-surface-variant">{item.meta}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
