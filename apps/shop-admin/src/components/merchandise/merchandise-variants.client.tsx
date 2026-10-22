"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import {
  MerchandiseVariantDialogs,
  type VariantDialogState,
} from "@/components/merchandise/merchandise-variant-dialogs.client";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { setMerchandiseVariantArchived } from "@/server/application/admin-merchandise-actions.server";
import type { MerchandiseVariantDetail } from "@auction/shop-contracts";
import { Button, ConfirmDialog, StatusBadge } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

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
  const mutation = useAdminMutation();

  const columns: ColumnDef<MerchandiseVariantDetail, unknown>[] = [
    {
      id: "sku",
      header: "SKU",
      cell: ({ row }) => {
        const variant = row.original;
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{variant.sku}</span>
              {variant.status === "archived" ? (
                <StatusBadge variant="neutral">Archived</StatusBadge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setDialog({ kind: "edit", variant })}
              >
                Edit<span className="sr-only"> {variant.sku}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setDialog({ kind: "stock", variant })}
              >
                Adjust stock<span className="sr-only"> for {variant.sku}</span>
              </Button>
              {variant.status === "active" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setArchiving(variant)}
                >
                  Archive<span className="sr-only"> {variant.sku}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={mutation.pending}
                  onClick={() =>
                    void mutation.run(
                      () =>
                        setMerchandiseVariantArchived({
                          variantId: variant.variantId,
                          archived: false,
                          idempotencyKey: mutation.idempotencyKey,
                        }),
                      `${variant.sku} restored.`,
                    )
                  }
                >
                  Restore<span className="sr-only"> {variant.sku}</span>
                </Button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "price",
      header: "Price",
      cell: ({ row }) => formatAdminDetailGbpPence(row.original.pricePence),
    },
    { id: "onHand", header: "On hand", cell: ({ row }) => row.original.onHand },
    {
      id: "reserved",
      header: "Held for checkouts",
      cell: ({ row }) => row.original.reserved,
    },
  ];

  return (
    <section aria-labelledby="variants-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="variants-heading" className="font-headline text-xl font-semibold">
            Variants
          </h2>
          <p className="text-sm text-on-surface-variant">
            Each variant is one SKU with its own price and stock.
          </p>
        </div>
        <Button type="button" onClick={() => setDialog({ kind: "add" })}>
          Add variant
        </Button>
      </div>
      {mutation.message ? (
        <p role="alert" className="text-sm text-error">
          {mutation.message}
        </p>
      ) : null}
      <AdminStaffDataTable
        columns={columns}
        data={variants}
        getRowId={(variant) => variant.variantId}
        empty={{
          title: "No variants",
          description: "Add a variant to give this product a SKU, a price and stock.",
        }}
        ariaLabel="Variants"
      />
      <MerchandiseVariantDialogs
        productId={productId}
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
        title={`Archive ${archiving?.sku ?? "this variant"}?`}
        body={
          <>
            <p>
              The variant stops being sold straight away, and shoppers who hold it in a basket can
              no longer check out with it. Orders already placed are not affected. Its SKU stays
              reserved so it cannot be reused, and you can restore it later.
            </p>
            {mutation.message ? (
              <p role="alert" className="mt-2 text-error">
                {mutation.message}
              </p>
            ) : null}
          </>
        }
        confirmLabel="Archive variant"
        tone="warning"
        loading={mutation.pending}
        onConfirm={async () => {
          if (!archiving) return;
          const saved = await mutation.run(
            () =>
              setMerchandiseVariantArchived({
                variantId: archiving.variantId,
                archived: true,
                idempotencyKey: mutation.idempotencyKey,
              }),
            `${archiving.sku} archived.`,
          );
          if (saved) setArchiving(null);
        }}
      />
    </section>
  );
}
