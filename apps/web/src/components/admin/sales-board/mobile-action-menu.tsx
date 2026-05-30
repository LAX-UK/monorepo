"use client";

import { buildSaleBoardMobileMenuItems } from "@/lib/admin/build-sale-board-mobile-menu";
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
  const defs = buildSaleBoardMobileMenuItems(row, { canManageSales });

  const items = defs.map((def) => ({
    type: "item" as const,
    label: def.label,
    onSelect: () => {
      if (def.kind === "copyId") {
        void navigator.clipboard.writeText(def.href).then(
          () => notify.success("Copied to clipboard"),
          () => notify.error("Could not copy to clipboard"),
        );
        return;
      }
      if (def.kind === "site") {
        window.open(def.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(def.href);
    },
  }));

  return <InlineActionMenu label={`Actions for ${row.title}`} items={items} />;
}
