"use client";

import {
  MerchandiseVariantDialogs,
  type VariantDialogState,
} from "@/components/merchandise/merchandise-variant-dialogs.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { setMerchandiseVariantArchived } from "@/server/application/admin-merchandise-actions.server";
import { presentStatus } from "@/server/domain/staff-status";
import type { MerchandiseVariantDetail } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  type DataColumn,
  MappedStatusBadge,
  type OverflowAction,
  RelatedRecordsSection,
  StaffButton,
  StaffMoney,
  rowActionsColumn,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, Pencil, Plus, SlidersHorizontal } from "@auction/staff-ui/icons";
import { useState } from "react";

const presentVariantStatus = presentStatus("merchandise");

function ArchiveVariantDialog({
  variant,
  onClose,
}: {
  variant: MerchandiseVariantDetail;
  onClose: () => void;
}) {
  const action = useAdminAction();
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Archive ${variant.sku}?`}
        description="The variant stops being sold straight away, and shoppers who hold it in a basket can no longer check out with it. Orders already placed are not affected. Its SKU stays reserved so it cannot be reused, and you can restore it later."
        confirmLabel="Archive variant"
        tone="danger"
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () =>
              setMerchandiseVariantArchived({
                variantId: variant.variantId,
                archived: true,
                idempotencyKey: action.idempotencyKey,
              }),
            `${variant.sku} archived`,
            "archive this variant",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * The product's variants with their stock. Price, SKU and archive changes are saved straight
 * away from here, separately from the product form above, because each is its own audited
 * change; stock is only ever set through the adjustment dialog, which asks for a reason.
 */
export function MerchandiseVariants({
  productId,
  variants,
}: {
  productId: string;
  variants: MerchandiseVariantDetail[];
}) {
  const [dialog, setDialog] = useState<VariantDialogState | null>(null);
  const [archiving, setArchiving] = useState<MerchandiseVariantDetail | null>(null);
  const restore = useAdminAction();

  const actionsFor = (variant: MerchandiseVariantDetail): OverflowAction[] => [
    {
      id: "edit",
      requires: "merchandise.write",
      label: "Edit…",
      icon: Pencil,
      onSelect: () => setDialog({ kind: "edit", variant }),
    },
    {
      id: "stock",
      requires: "merchandise.write",
      label: "Adjust stock…",
      icon: SlidersHorizontal,
      onSelect: () => setDialog({ kind: "stock", variant }),
    },
    variant.status === "active"
      ? {
          id: "archive",
          requires: "merchandise.write",
          label: "Archive…",
          icon: Archive,
          tone: "danger",
          onSelect: () => setArchiving(variant),
        }
      : {
          id: "restore",
          requires: "merchandise.write",
          label: "Restore",
          icon: ArchiveRestore,
          disabled: restore.pending,
          onSelect: () =>
            void restore.run(
              () =>
                setMerchandiseVariantArchived({
                  variantId: variant.variantId,
                  archived: false,
                  idempotencyKey: restore.idempotencyKey,
                }),
              `${variant.sku} restored`,
              "restore this variant",
            ),
        },
  ];

  const columns: DataColumn<MerchandiseVariantDetail>[] = [
    {
      id: "sku",
      header: "SKU",
      mobile: "title",
      cell: (variant) => <span className="font-mono">{variant.sku}</span>,
    },
    {
      id: "status",
      header: "Status",
      width: "128px",
      mobile: "badge",
      truncate: false,
      cell: (variant) => (
        <MappedStatusBadge status={variant.status} present={presentVariantStatus} />
      ),
    },
    {
      id: "price",
      header: "Price",
      width: "120px",
      numeric: true,
      mobile: "meta",
      cell: (variant) => <StaffMoney minor={variant.pricePence} />,
    },
    {
      id: "onHand",
      header: "On hand",
      width: "104px",
      numeric: true,
      mobile: "meta",
      cell: (variant) => (
        <>
          {variant.onHand}
          <span className="md:hidden"> on hand</span>
        </>
      ),
    },
    {
      id: "reserved",
      header: "Held for checkouts",
      width: "160px",
      numeric: true,
      mobile: "meta",
      cell: (variant) => (
        <>
          {variant.reserved}
          <span className="md:hidden"> held</span>
        </>
      ),
    },
    rowActionsColumn<MerchandiseVariantDetail>({
      actions: actionsFor,
      label: (variant) => `Actions for ${variant.sku}`,
    }),
  ];

  return (
    <>
      <RelatedRecordsSection<MerchandiseVariantDetail>
        id="variants"
        title="Variants"
        description="Each variant is one SKU with its own price and stock."
        columns={columns}
        data={variants}
        getRowId={(variant) => variant.variantId}
        defaultSort={{ columnId: "sku", direction: "asc" }}
        action={
          <StaffButton
            variant="secondary"
            size="sm"
            requires="merchandise.write"
            icon={<Plus aria-hidden />}
            onClick={() => setDialog({ kind: "add" })}
          >
            Add variant
          </StaffButton>
        }
        empty={{
          title: "No variants",
          description: "Add a variant to give this product a SKU, a price and stock.",
        }}
      />
      {restore.error}
      {restore.stepUpDialog}
      <MerchandiseVariantDialogs
        productId={productId}
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
      {archiving ? (
        <ArchiveVariantDialog variant={archiving} onClose={() => setArchiving(null)} />
      ) : null}
    </>
  );
}
