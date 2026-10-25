"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import {
  EMPTY_PRESS_FORM,
  MENTION_TYPE_OPTIONS,
  type PressFormState,
  PressMentionDialog,
} from "@/components/admin/sale-detail/tabs/press-mention-form";
import {
  type PressItem,
  toPressItem,
  usePressMutations,
} from "@/components/admin/sale-detail/tabs/use-press-mutations";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { notify } from "@/lib/ui/notify";
import {
  type DataColumn,
  EmptyValue,
  PrimaryCell,
  StaffButton,
  StaffDate,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { SalePressMentionType, SalePressRef } from "@auction/types";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  saleId: string;
  initialPressCoverage: SalePressRef[];
  canManage: boolean;
};

type PressRow = PressItem & { position: number };

const MENTION_LABELS = new Map<SalePressMentionType, string>(
  MENTION_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

function toForm(item: PressItem): PressFormState {
  return {
    url: item.url,
    headline: item.headline,
    outletName: item.outletName,
    publishedAt: item.publishedAt ?? "",
    excerpt: item.excerpt ?? "",
    mentionType: item.mentionType ?? "",
  };
}

/** The saved reference for a form, keeping what the form does not edit (the preview image). */
function fromForm(form: PressFormState, previous?: PressItem): SalePressRef {
  const ref: SalePressRef = {
    url: form.url.trim(),
    headline: form.headline.trim(),
    outletName: form.outletName.trim(),
  };
  if (form.publishedAt.trim()) ref.publishedAt = form.publishedAt.trim();
  if (form.excerpt.trim()) ref.excerpt = form.excerpt.trim();
  if (form.mentionType) ref.mentionType = form.mentionType;
  if (previous?.imageUrl && previous.url === ref.url) ref.imageUrl = previous.imageUrl;
  return ref;
}

/**
 * A sale's press coverage as one section: the links in the order the public page shows them, with
 * the outlet, type and date. Adding and editing happen in a dialog; removing asks first, and
 * reordering is the `…` menu's Move up and Move down. Every change is saved as it is made.
 */
export function SalePressTab({ saleId, initialPressCoverage, canManage }: Props) {
  const { saving, persistPressCoverage } = usePressMutations(saleId);
  const confirm = useStaffConfirm();
  const [items, setItems] = useState<PressItem[]>(() => initialPressCoverage.map(toPressItem));
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; itemId: string } | null>(
    null,
  );

  const editing = dialog?.mode === "edit" ? items.find((item) => item.id === dialog.itemId) : null;
  const initialForm = useMemo(() => (editing ? toForm(editing) : EMPTY_PRESS_FORM), [editing]);

  const rows = useMemo<PressRow[]>(
    () => items.map((item, index) => ({ ...item, position: index + 1 })),
    [items],
  );

  const save = async (next: PressItem[]) => {
    const result = await persistPressCoverage(next);
    if (result.ok) setItems(next);
    return result;
  };

  const submitForm = (form: PressFormState) => {
    if (editing) {
      const ref = fromForm(form, editing);
      return save(items.map((item) => (item.id === editing.id ? { ...ref, id: item.id } : item)));
    }
    return save([...items, toPressItem(fromForm(form), items.length)]);
  };

  const move = async (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    const result = await save(next);
    if (!result.ok) notify.error("The order was not saved", { description: result.error });
  };

  const remove = (item: PressItem) =>
    confirm.ask({
      title: "Remove this press link?",
      description: `"${item.headline}" comes off the sale's public press coverage. The article itself is not affected.`,
      confirmLabel: "Remove link",
      tone: "danger",
      run: async () => {
        const next = items.filter((it) => it.id !== item.id);
        const result = await persistPressCoverage(next);
        if (result.ok) setItems(next);
        return result;
      },
      success: "Press link removed",
      // The save already refreshed the page.
      onSuccess: () => undefined,
    });

  const columns: DataColumn<PressRow>[] = [
    {
      id: "position",
      header: "Order",
      width: "72px",
      numeric: true,
      sortable: true,
      sortValue: (row) => row.position,
      mobile: "hidden",
      cell: (row) => row.position,
    },
    {
      id: "headline",
      header: "Article",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={row.url}
          external
          thumbnail={{ src: row.imageUrl ?? null, missingLabel: "No preview image" }}
          secondary={row.outletName}
        >
          {row.headline}
        </PrimaryCell>
      ),
    },
    {
      id: "type",
      header: "Type",
      width: "120px",
      hideBelow: "md",
      mobile: "meta",
      cell: (row) =>
        row.mentionType ? (MENTION_LABELS.get(row.mentionType) ?? row.mentionType) : <EmptyValue />,
    },
    {
      id: "published",
      header: "Published",
      width: "128px",
      sortable: true,
      sortValue: (row) => row.publishedAt ?? null,
      defaultSortDirection: "desc",
      mobile: "meta",
      truncate: false,
      cell: (row) => <StaffDate value={row.publishedAt} />,
    },
    rowActionsColumn<PressRow>({
      label: (row) => `Actions for ${row.headline}`,
      actions: (row) => {
        const index = row.position - 1;
        return [
          { id: "open", label: "Open article", href: row.url },
          ...(canManage
            ? [
                {
                  id: "edit",
                  label: "Edit details",
                  onSelect: () => setDialog({ mode: "edit", itemId: row.id }),
                },
                {
                  id: "up",
                  label: "Move up",
                  onSelect: () => void move(index, -1),
                  ...(index === 0 ? { disabledReason: "Already first" } : {}),
                },
                {
                  id: "down",
                  label: "Move down",
                  onSelect: () => void move(index, 1),
                  ...(index === items.length - 1 ? { disabledReason: "Already last" } : {}),
                },
                {
                  id: "remove",
                  label: "Remove link…",
                  tone: "danger" as const,
                  onSelect: () => remove(row),
                },
              ]
            : []),
        ];
      },
    }),
  ];

  return (
    <>
      <RelatedRecordsSection<PressRow>
        id="press-coverage"
        title="Press coverage"
        description="Articles about this sale, in the order the public page shows them."
        label="Press coverage"
        action={
          canManage ? (
            <StaffButton
              variant="primary"
              size="sm"
              icon={<Plus aria-hidden />}
              disabled={saving}
              onClick={() => setDialog({ mode: "add" })}
            >
              Add press link
            </StaffButton>
          ) : null
        }
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        defaultSort={{ columnId: "position", direction: "asc" }}
        density="comfortable"
        empty={{
          title: "No press links yet",
          description: canManage
            ? "Add links to articles about this sale. They appear on the sale's public press coverage."
            : "Links to articles about this sale appear here once they are added.",
          ...(canManage
            ? {
                action: (
                  <StaffButton
                    variant="primary"
                    size="sm"
                    onClick={() => setDialog({ mode: "add" })}
                  >
                    Add press link
                  </StaffButton>
                ),
              }
            : {}),
        }}
      />
      <PressMentionDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        mode={dialog?.mode ?? "add"}
        initial={initialForm}
        onSubmit={submitForm}
      />
      {confirm.dialog}
    </>
  );
}
