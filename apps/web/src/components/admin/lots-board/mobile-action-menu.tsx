"use client";

import { adminLotEditHref, adminLotHref } from "@/lib/admin/catalog-route-helpers";
import { lotPath } from "@/lib/seo/url";
import { notify } from "@/lib/ui/notify";
import { InlineActionMenu } from "@auction/ui";
import { useRouter } from "next/navigation";
import type { AdminLotTableRow } from "./types";

export function LotBoardMobileActionMenu({
  row,
  canManageCatalog = false,
}: {
  row: AdminLotTableRow;
  canManageCatalog?: boolean;
}) {
  const router = useRouter();
  const publicHref = lotPath({ id: row.id, title: row.title });
  const items = [
    {
      type: "item" as const,
      label: "Open detail",
      onSelect: () => router.push(adminLotHref(row.id)),
    },
    {
      type: "item" as const,
      label: "Edit",
      onSelect: () => router.push(adminLotEditHref(row.id)),
    },
    {
      type: "item" as const,
      label: "View on site",
      onSelect: () => window.open(publicHref, "_blank", "noopener,noreferrer"),
    },
    {
      type: "item" as const,
      label: "Copy lot ID",
      onSelect: () => {
        void navigator.clipboard.writeText(row.id).then(
          () => notify.success("Copied to clipboard"),
          () => notify.error("Could not copy to clipboard"),
        );
      },
    },
  ];
  if (canManageCatalog && row.status === "draft") {
    items.splice(2, 0, {
      type: "item" as const,
      label: "Publish",
      onSelect: () => router.push(`${adminLotHref(row.id)}?focus=publish`),
    });
  }
  return <InlineActionMenu label={`Actions for ${row.title}`} items={items} />;
}
