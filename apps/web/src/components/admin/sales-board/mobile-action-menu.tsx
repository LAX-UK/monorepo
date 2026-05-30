"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminSoftDeleteSaleResultAction } from "@/lib/actions/admin-sales";
import { buildSaleBoardMobileMenuItems } from "@/lib/admin/build-sale-board-mobile-menu";
import { notify } from "@/lib/ui/notify";
import { saleDeleteConfirmationPhrase } from "@auction/validators";
import { InlineActionMenu } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminSaleBoardRow } from "./types";

export function SaleBoardMobileActionMenu({
  row,
  canManageSales,
}: {
  row: AdminSaleBoardRow;
  canManageSales: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const defs = buildSaleBoardMobileMenuItems(row, { canManageSales });
  const deletePhrase = saleDeleteConfirmationPhrase(row.title);

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
      {canManageSales && row.canDelete ? (
        <TypedConfirmationDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete this sale?"
          description="The sale and all lots will be removed from the catalogue. Data is retained for audit. Use cancel if the sale should stay visible as cancelled."
          actionLabel="Delete sale"
          confirmationPhrase={deletePhrase}
          severity="danger"
          onConfirm={async () => {
            const r = await adminSoftDeleteSaleResultAction(row.saleId, deletePhrase);
            if (!r.ok) {
              notify.error(r.error);
              throw new Error(r.error);
            }
            notify.success("Sale deleted");
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
