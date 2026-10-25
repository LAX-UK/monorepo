"use client";

import {
  type CategoriesStaffRow,
  assignmentsLabel,
} from "@/lib/admin/categories/categories-staff-list.vm";
import {
  DetailPanel,
  type OverflowAction,
  OverflowMenu,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";

const count = new Intl.NumberFormat("en-GB");

/**
 * A category beside the list: where it is used, its description and ordering, with the category
 * page, the editor and the same actions as the row's `…` menu. Built from the row, so it opens
 * at once.
 */
export function CategoryQuickView({
  row,
  onClose,
  actions,
}: {
  row: CategoriesStaffRow | null;
  onClose: () => void;
  actions: readonly OverflowAction[];
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.name ?? "Category"}
      status={row ? <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge> : null}
      meta={
        row
          ? [
              { label: "Slug", value: `/${row.slug}` },
              { label: "Used", value: assignmentsLabel(row.assignments) },
            ]
          : []
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.href}>Open full page</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        actions.length > 0 ? (
          <OverflowMenu label="Category actions" actions={actions} Link={Link} />
        ) : null
      }
      summary={
        row
          ? [
              { label: "Description", value: row.description },
              { label: "Lots", value: count.format(row.lots) },
              { label: "Sales", value: count.format(row.sales) },
              { label: "Submissions", value: count.format(row.submissions) },
              { label: "Buyer interests", value: count.format(row.interests) },
              { label: "Position", value: count.format(row.sortOrder) },
              { label: "Hero image", value: row.hasHeroImage ? "Set" : null },
              { label: "Updated", value: <StaffDate value={row.updatedAt} /> },
              { label: "Added", value: <StaffDate value={row.createdAt} /> },
              { label: "Category ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row ? (
          <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
            <Link href={row.editHref}>Edit category</Link>
          </StaffButton>
        ) : null
      }
    >
      {null}
    </DetailPanel>
  );
}
