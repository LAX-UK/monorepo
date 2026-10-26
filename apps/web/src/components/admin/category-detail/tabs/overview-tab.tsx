"use client";

import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { categoryAncestorsOf } from "@/components/admin/category-detail/category-detail-helpers";
import {
  categoryDetailTabHref,
  categoryEditHref,
  categorySubmissionsHref,
} from "@/components/admin/category-detail/category-detail-types";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { buildCategoryTaxonomyReadiness } from "@/lib/admin/catalog-readiness";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminDomainEventRow, AdminSaleListRow } from "@/lib/data/http/admin.server";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import {
  type DataColumn,
  DetailColumns,
  type IssueItem,
  IssueList,
  KeyValueList,
  PrimaryCell,
  RecordImage,
  Section,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatGrid,
  StatusBadge,
  TextLink,
} from "@auction/staff-ui";
import type { AdminCategory, ItemSubmission, Lot } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  categoryId: string;
  category: AdminCategory;
  allCategories: AdminCategory[];
  directChildCount: number;
  descendantCount: number;
  previewLots: Lot[];
  previewSales: AdminSaleListRow[];
  previewSubmissions: ItemSubmission[];
  activityEvents?: readonly AdminDomainEventRow[];
};

type LinkedRow = { id: string; title: string; href: string; status: string; detail?: string };

function linkedColumns(
  noun: string,
  domain: "lot" | "sale" | "submission",
): DataColumn<LinkedRow>[] {
  return [
    {
      id: "title",
      header: noun,
      mobile: "title",
      cell: (row) => (
        <PrimaryCell href={row.href} Link={NextLink} secondary={row.detail}>
          {row.title}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "140px",
      mobile: "badge",
      cell: (row) => {
        const status = staffStatus(domain, row.status);
        return (
          <StatusBadge tone={status.tone} live={status.live ?? false}>
            {status.label}
          </StatusBadge>
        );
      },
    },
  ];
}

const LOT_COLUMNS = linkedColumns("Lot", "lot");
const SALE_COLUMNS = linkedColumns("Sale", "sale");
const SUBMISSION_COLUMNS = linkedColumns("Submission", "submission");

function LinkedRecords({
  title,
  label,
  viewAllHref,
  columns,
  rows,
}: {
  title: string;
  label: string;
  viewAllHref: string;
  columns: DataColumn<LinkedRow>[];
  rows: LinkedRow[];
}) {
  return (
    <RelatedRecordsSection<LinkedRow>
      title={title}
      label={label}
      action={
        <StaffButton asChild size="sm" variant="ghost">
          <Link href={viewAllHref}>View all</Link>
        </StaffButton>
      }
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      defaultSort={{ columnId: "title", direction: "asc" }}
      empty={{ title: `No ${title.toLowerCase()} yet`, description: "Nothing uses this category." }}
    />
  );
}

/**
 * The category at a glance: its subcategories, lots, sales and submissions in numbers, what is
 * missing from it, its presentation and place in the tree, and the latest records that use it;
 * its picture, recent activity and the record's dates in the rail.
 */
export function CategoryOverviewTab({
  categoryId,
  category,
  allCategories,
  directChildCount,
  descendantCount,
  previewLots,
  previewSales,
  previewSubmissions,
  activityEvents = [],
}: Props) {
  const ancestors = categoryAncestorsOf(categoryId, allCategories);
  const heroSrc = resolveMediaSrc(category.heroImageKey);

  const issues = useMemo<IssueItem[]>(
    () =>
      buildCategoryTaxonomyReadiness(categoryId, category, directChildCount)
        .items.filter((item) => !item.ok && item.id !== "branch")
        .map((item) => ({
          id: item.id,
          label:
            item.id === "description"
              ? "The category has no description"
              : item.id === "hero"
                ? "The category has no hero image"
                : "The category is archived but still in use",
          tone: "warning" as const,
          tag: "Presentation",
          action: { label: "Edit", href: item.href ?? categoryEditHref(categoryId) },
        })),
    [category, categoryId, directChildCount],
  );

  const rail = (
    <>
      {heroSrc ? (
        <Section title="Hero image">
          <RecordImage src={heroSrc} alt={`${category.name} hero`} />
        </Section>
      ) : null}
      <Section
        title="Activity"
        action={
          <StaffButton asChild size="sm" variant="ghost">
            <Link href={categoryDetailTabHref(categoryId, "activity")}>View all</Link>
          </StaffButton>
        }
      >
        <AuditTimeline
          label="Category activity"
          events={activityEvents}
          limit={5}
          empty="No activity recorded yet."
        />
      </Section>
      <Section title="Record">
        <KeyValueList
          items={[
            { label: "Category ID", value: category.id, copyValue: category.id },
            { label: "Created", value: <StaffDate value={category.createdAt} withTime /> },
            { label: "Updated", value: <StaffDate value={category.updatedAt} withTime /> },
          ]}
        />
      </Section>
    </>
  );

  return (
    <DetailColumns rail={rail} railLabel="Category activity">
      <StatGrid
        label="Category usage"
        items={[
          { id: "children", label: "Subcategories", value: String(directChildCount) },
          { id: "lots", label: "Lots", value: String(category.usage.lots) },
          { id: "sales", label: "Sales", value: String(category.usage.sales) },
          { id: "submissions", label: "Submissions", value: String(category.usage.submissions) },
        ]}
      />
      <IssueList Link={NextLink} items={issues} allClear={null} />
      <Section title="Presentation" description="The public copy and picture for this category.">
        <KeyValueList
          items={[{ label: "Description", value: category.description?.trim() || null }]}
        />
      </Section>
      <Section title="Place in the tree">
        <KeyValueList
          items={[
            { label: "Sort order", value: String(category.sortOrder), numeric: true },
            {
              label: "Subcategories",
              value: (
                <span className="flex flex-wrap items-center gap-x-2">
                  {directChildCount} direct
                  {descendantCount > directChildCount ? `, ${descendantCount} in all` : ""}
                  {descendantCount > 0 ? (
                    <TextLink Link={NextLink} href={categoryDetailTabHref(categoryId, "children")}>
                      View
                    </TextLink>
                  ) : null}
                </span>
              ),
            },
            {
              label: "Parents",
              value:
                ancestors.length === 0 ? (
                  "Top level"
                ) : (
                  <ol className="flex flex-wrap items-center gap-1">
                    {ancestors.map((ancestor, index) => (
                      <li key={ancestor.id} className="flex items-center gap-1">
                        {index > 0 ? <span aria-hidden>/</span> : null}
                        <TextLink Link={NextLink} href={`/admin/categories/${ancestor.id}`}>
                          {ancestor.name}
                        </TextLink>
                      </li>
                    ))}
                  </ol>
                ),
            },
          ]}
        />
      </Section>
      {previewLots.length > 0 ? (
        <LinkedRecords
          title="Recent lots"
          label="Recent lots in this category"
          viewAllHref={categoryDetailTabHref(categoryId, "lots")}
          columns={LOT_COLUMNS}
          rows={previewLots.map((lot) => ({
            id: lot.id,
            title: lot.title,
            href: `/admin/lots/${lot.id}`,
            status: lot.status,
          }))}
        />
      ) : null}
      {previewSales.length > 0 ? (
        <LinkedRecords
          title="Recent sales"
          label="Recent sales in this category"
          viewAllHref={categoryDetailTabHref(categoryId, "sales")}
          columns={SALE_COLUMNS}
          rows={previewSales.map(({ sale, lots }) => ({
            id: sale.id,
            title: sale.title,
            href: `/admin/sales/${sale.id}`,
            status: sale.status,
            detail: `${lots.length} ${lots.length === 1 ? "lot" : "lots"}`,
          }))}
        />
      ) : null}
      {previewSubmissions.length > 0 ? (
        <LinkedRecords
          title="Recent submissions"
          label="Recent submissions in this category"
          viewAllHref={categorySubmissionsHref(categoryId)}
          columns={SUBMISSION_COLUMNS}
          rows={previewSubmissions.map((submission) => ({
            id: submission.id,
            title: submission.title,
            href: `/admin/submissions/${submission.id}`,
            status: submission.status,
          }))}
        />
      ) : null}
    </DetailColumns>
  );
}
