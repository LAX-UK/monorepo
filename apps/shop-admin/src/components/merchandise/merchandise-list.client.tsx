"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { knownFacts, useWorkList } from "@/components/use-work-list.client";
import { setMerchandiseProductArchived } from "@/server/application/admin-merchandise-actions.server";
import {
  type MerchandiseListRow,
  merchandiseList,
  priceRangeLabel,
  variantsLabel,
} from "@/server/domain/merchandise-list.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import {
  ConfirmActionDialog,
  type DataColumn,
  DetailPanel,
  EmptyValue,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, PanelRight, Pencil, Plus } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

const presentMerchandiseStatus = presentStatus("merchandise");

function ArchiveProductDialog({
  product,
  onClose,
}: {
  product: MerchandiseListRow;
  onClose: () => void;
}) {
  const action = useAdminAction();
  const archive = product.status === "active";
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`${archive ? "Archive" : "Restore"} “${product.title}”?`}
        description={
          archive
            ? "The product is removed from LAX Shop straight away: it leaves the catalogue, its page is not found and shoppers holding it in a basket can no longer check out with it. Orders already placed are not affected and nothing is deleted. You can restore it later."
            : "The product returns to LAX Shop straight away, with its variants that are on sale, and can be bought again."
        }
        confirmLabel={archive ? "Archive product" : "Restore product"}
        tone={archive ? "danger" : "default"}
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () =>
              setMerchandiseProductArchived({
                productId: product.id,
                archived: archive,
                idempotencyKey: action.idempotencyKey,
              }),
            archive ? `Archived “${product.title}”` : `Restored “${product.title}”`,
            `${archive ? "archive" : "restore"} this product`,
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

type PageData = {
  items: MerchandiseListRow[];
  nextCursor: string | null;
  counts?: Record<string, number>;
};

/**
 * Products on the staff list template: a view for all, on sale and archived products with
 * counts, search by title, slug or SKU, 50 a page, a record panel linked from the URL
 * (`?product=`) and Archive or Restore on every row. The server lists newest first, so the list
 * shows no sort.
 */
export function MerchandiseList({
  state,
  page,
  canWrite = true,
  loadFailed = false,
}: {
  state: WorkListState;
  page: PageData;
  canWrite?: boolean;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: merchandiseList,
    state,
    page,
    noun: { one: "product", other: "products" },
    search: { label: "Search products", placeholder: "Search by title, slug or SKU" },
  });
  const [archiving, setArchiving] = useState<MerchandiseListRow | null>(null);
  const opened = page.items.find((row) => row.id === list.panel.openId) ?? null;
  const editHref = (row: MerchandiseListRow) => `/merchandise/${row.id}`;

  const columns = useMemo<DataColumn<MerchandiseListRow>[]>(
    () => [
      {
        id: "title",
        header: "Product",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={list.panelHref(row.id)}
            Link={list.panel.PanelLink}
            secondary={`/${row.slug}`}
          >
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentMerchandiseStatus} />,
      },
      {
        id: "variants",
        header: "Variants",
        width: "18%",
        mobile: "meta",
        cell: (row) => variantsLabel(row.variantCount),
      },
      {
        id: "price",
        header: "Price",
        width: "18%",
        mobile: "meta",
        truncate: false,
        cell: (row) => {
          const label = priceRangeLabel(row.fromPricePence, row.toPricePence);
          return label ? <span className="tabular-nums">{label}</span> : <EmptyValue />;
        },
      },
      {
        id: "stock",
        header: "In stock",
        width: "104px",
        align: "end",
        mobile: "meta",
        cell: (row) => <span className="tabular-nums">{row.totalOnHand}</span>,
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const archiveAction = (row: MerchandiseListRow): OverflowAction | null =>
    canWrite
      ? {
          id: "archive",
          label: row.status === "active" ? "Archive…" : "Restore…",
          icon: row.status === "active" ? Archive : ArchiveRestore,
          ...(row.status === "active" ? { tone: "danger" as const } : {}),
          onSelect: () => setArchiving(row),
        }
      : null;

  const newProduct = canWrite ? (
    <StaffButton asChild variant="primary" icon={<Plus aria-hidden />}>
      <list.Link href="/merchandise/new">New product</list.Link>
    </StaffButton>
  ) : undefined;

  return (
    <>
      <ListPage<MerchandiseListRow>
        title="Products"
        description="Merchandise sold on LAX Shop, with its variants, prices and stock."
        Link={list.Link}
        listKey="lax-admin.merchandise"
        {...(newProduct ? { primaryAction: newProduct } : {})}
        views={list.views}
        search={list.search}
        activeFilters={list.searchChip}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Products did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(merchandiseList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "easel",
          title:
            state.view === "archived"
              ? "No archived products"
              : state.view === "active"
                ? "No products on sale"
                : "No products yet",
          description:
            state.view === "all"
              ? "Create a product to start selling merchandise on LAX Shop."
              : "Products appear here as they are put on sale or archived.",
          ...(newProduct && state.view === "all" ? { action: newProduct } : {}),
        }}
        noResults={{ noun: "products" }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          onRowOpen: (row) => list.panel.show(row.id),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) =>
              [
                {
                  id: "open",
                  label: "Open details",
                  icon: PanelRight,
                  onSelect: () => list.panel.show(row.id),
                },
                { id: "edit", label: "Edit", icon: Pencil, href: editHref(row) },
                archiveAction(row),
              ].filter((action): action is OverflowAction => action !== null),
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened?.title ?? "Product"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentMerchandiseStatus} />
          ) : null
        }
        meta={
          opened
            ? [
                { label: "Variants", value: variantsLabel(opened.variantCount) },
                { label: "In stock", value: String(opened.totalOnHand) },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                {
                  label: "Price",
                  value: priceRangeLabel(opened.fromPricePence, opened.toPricePence),
                },
                { label: "Slug", value: `/${opened.slug}`, copyValue: opened.slug },
                { label: "Product ID", value: opened.id, copyValue: opened.id },
              ])
            : []
        }
        footer={
          opened ? (
            <>
              {archiveAction(opened) ? (
                <StaffButton
                  variant="secondary"
                  icon={
                    opened.status === "active" ? (
                      <Archive aria-hidden />
                    ) : (
                      <ArchiveRestore aria-hidden />
                    )
                  }
                  onClick={() => setArchiving(opened)}
                >
                  {opened.status === "active" ? "Archive" : "Restore"}
                </StaffButton>
              ) : null}
              <StaffButton asChild variant="primary" icon={<Pencil aria-hidden />}>
                <list.Link href={editHref(opened)}>Edit</list.Link>
              </StaffButton>
            </>
          ) : null
        }
      >
        {null}
      </DetailPanel>

      {archiving ? (
        <ArchiveProductDialog product={archiving} onClose={() => setArchiving(null)} />
      ) : null}
    </>
  );
}
