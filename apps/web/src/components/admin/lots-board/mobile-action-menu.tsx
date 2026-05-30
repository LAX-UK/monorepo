"use client";

import { buildLotBoardMobileMenuItems } from "@/lib/admin/build-lot-board-mobile-menu";
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
  const defs = buildLotBoardMobileMenuItems(row, { canManageCatalog });

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
