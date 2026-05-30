"use client";

import {
  adminSaleEditHref,
  adminSaleHref,
  adminSaleSetupHref,
} from "@/lib/admin/catalog-route-helpers";
import { salePath } from "@/lib/seo/url";
import { notify } from "@/lib/ui/notify";
import { InlineActionMenu } from "@auction/ui";
import { useRouter } from "next/navigation";
import type { AdminSaleBoardRow } from "./types";

export function SaleBoardMobileActionMenu({
  row,
  canManageSales,
}: {
  row: AdminSaleBoardRow;
  canManageSales: boolean;
}) {
  const router = useRouter();
  const publicPath = salePath({ id: row.saleId, title: row.title });
  const items = [
    {
      type: "item" as const,
      label: "Manage",
      onSelect: () => router.push(adminSaleHref(row.saleId)),
    },
    {
      type: "item" as const,
      label: "Edit",
      onSelect: () => router.push(adminSaleEditHref(row.saleId)),
    },
    {
      type: "item" as const,
      label: "View on site",
      onSelect: () => window.open(publicPath, "_blank", "noopener,noreferrer"),
    },
    {
      type: "item" as const,
      label: "Copy sale ID",
      onSelect: () => {
        void navigator.clipboard.writeText(row.saleId).then(
          () => notify.success("Copied to clipboard"),
          () => notify.error("Could not copy to clipboard"),
        );
      },
    },
  ];
  if (canManageSales && row.status === "draft") {
    items.splice(2, 0, {
      type: "item" as const,
      label: "Continue setup",
      onSelect: () => router.push(adminSaleSetupHref(row.saleId)),
    });
  }
  return <InlineActionMenu label={`Actions for ${row.title}`} items={items} />;
}
