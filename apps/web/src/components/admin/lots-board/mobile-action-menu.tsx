"use client";

import {
  DeleteLotDialog,
  useDeleteLotDialog,
} from "@/components/admin/lot-actions/delete-lot-button";
import { buildLotBoardMobileMenuItems } from "@/lib/admin/build-lot-board-mobile-menu";
import { notify } from "@/lib/ui/notify";
import { InlineActionMenu } from "@auction/ui";
import { useRouter } from "next/navigation";
import type { AdminLotTableRow } from "./types";

export function LotBoardMobileActionMenu({
  row,
  canManageCatalog = false,
  canManageAuction = false,
}: {
  row: AdminLotTableRow;
  canManageCatalog?: boolean;
  canManageAuction?: boolean;
}) {
  const router = useRouter();
  const { open: deleteOpen, setOpen: setDeleteOpen } = useDeleteLotDialog();
  const defs = buildLotBoardMobileMenuItems(row, { canManageCatalog, canManageAuction });

  const items = defs.map((def) => ({
    type: "item" as const,
    label: def.label,
    destructive: def.kind === "delete",
    onSelect: () => {
      if (def.kind === "copyId") {
        void navigator.clipboard.writeText(def.href).then(
          () => notify.success("Copied to clipboard"),
          () => notify.error("Could not copy to clipboard"),
        );
        return;
      }
      if (def.kind === "delete") {
        setDeleteOpen(true);
        return;
      }
      if (def.kind === "site") {
        window.open(def.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(def.href);
    },
  }));

  return (
    <>
      <InlineActionMenu label={`Actions for ${row.title}`} items={items} />
      {row.canDelete ? (
        <DeleteLotDialog
          lotId={row.id}
          lotTitle={row.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </>
  );
}
