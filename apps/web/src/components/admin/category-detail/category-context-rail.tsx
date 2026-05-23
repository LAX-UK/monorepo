import { CatalogInfoAside } from "@/components/admin/catalog/catalog-info-aside";
import {
  categoryDetailTabHref,
  categoryEditHref,
  categorySubmissionsHref,
} from "@/components/admin/category-detail/category-detail-types";
import { categoryActivityTabHref } from "@/components/admin/category-detail/tabs/activity-tab";
import {
  ActivitySnapshotRail,
  KpiStackRail,
  QuickActionsRail,
  RelatedEntitiesRail,
} from "@/components/admin/detail-rail";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";
import { FolderTree } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  categoryId: string;
  category: AdminCategory;
  directChildCount: number;
  status?: ReactNode;
  activityEvents?: readonly AdminDomainEventRow[];
  parentName?: string | null;
};

export function CategoryContextRail({
  categoryId,
  category,
  directChildCount,
  status,
  activityEvents = [],
  parentName = null,
}: Props) {
  const related = [
    ...(category.parentId
      ? [
          {
            id: category.parentId,
            kind: "Parent",
            label: parentName ?? "Parent category",
            href: `/admin/categories/${category.parentId}`,
            icon: <FolderTree className="size-4" aria-hidden />,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 lg:sticky lg:top-28">
      <CatalogInfoAside
        entityId={categoryId}
        updatedAt={category.updatedAt}
        {...(status ? { status } : {})}
      />
      <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
        <KpiStackRail
          items={[
            { id: "children", label: "Direct children", value: String(directChildCount) },
            { id: "lots", label: "Lots", value: String(category.usage.lots) },
            { id: "sales", label: "Sales", value: String(category.usage.sales) },
            {
              id: "submissions",
              label: "Submissions",
              value: String(category.usage.submissions),
            },
          ]}
        />
        <QuickActionsRail
          actions={[
            {
              id: "edit",
              label: "Edit category",
              href: categoryEditHref(categoryId),
              variant: "default",
            },
            {
              id: "lots",
              label: "View lots",
              href: categoryDetailTabHref(categoryId, "lots"),
              variant: "outline",
            },
            ...(category.usage.sales > 0
              ? [
                  {
                    id: "sales",
                    label: "View sales",
                    href: categoryDetailTabHref(categoryId, "sales"),
                    variant: "outline" as const,
                  },
                ]
              : []),
            ...(category.usage.submissions > 0
              ? [
                  {
                    id: "submissions",
                    label: "View submissions",
                    href: categorySubmissionsHref(categoryId),
                    variant: "outline" as const,
                  },
                ]
              : []),
          ]}
        />
        {related.length > 0 ? <RelatedEntitiesRail items={related} /> : null}
        <ActivitySnapshotRail
          events={activityEvents.map((e) => ({
            id: e.id,
            label: domainEventLabel(e.eventType),
            at: e.occurredAt.toISOString(),
            actor: e.actorUserId,
          }))}
          viewAllHref={categoryActivityTabHref(categoryId)}
          viewAllLabel="View all activity"
        />
      </div>
    </div>
  );
}
