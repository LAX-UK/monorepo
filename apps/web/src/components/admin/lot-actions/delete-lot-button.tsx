"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminSoftDeleteLotResultAction } from "@/lib/actions/admin";
import { adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import { notify } from "@/lib/ui/notify";
import { lotDeleteConfirmationPhrase } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type DeleteLotParentSale = {
  id: string;
  title: string;
  status: string;
  lotCount: number;
};

type Props = {
  lotId: string;
  lotTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentSale?: DeleteLotParentSale | null;
};

/** Typed confirmation dialog for lot soft-delete — parent owns menu trigger. */
export function DeleteLotDialog({ lotId, lotTitle, open, onOpenChange, parentSale = null }: Props) {
  const router = useRouter();
  const phrase = lotDeleteConfirmationPhrase(lotTitle);

  return (
    <TypedConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this lot?"
      description="The lot will be removed from the catalogue. Data is retained for audit. Use cancel if the lot should stay visible as cancelled."
      actionLabel="Delete lot"
      confirmationPhrase={phrase}
      severity="danger"
      onConfirm={async () => {
        const r = await adminSoftDeleteLotResultAction(lotId, phrase);
        if (!r.ok) {
          notify.error(r.error);
          throw new Error(r.error);
        }

        const orphanDraftSale =
          parentSale?.status === "draft" && parentSale.lotCount === 1 ? parentSale : null;
        if (orphanDraftSale) {
          const saleHref = adminSaleHref(orphanDraftSale.id);
          notify.action("Lot deleted", {
            description: `Draft sale “${orphanDraftSale.title}” has no lots — you can delete the sale too.`,
            actionLabel: "View sale",
            onAction: () => router.push(saleHref),
          });
        } else {
          notify.success("Lot deleted");
        }

        router.push("/admin/lots");
      }}
    />
  );
}

export function useDeleteLotDialog() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
