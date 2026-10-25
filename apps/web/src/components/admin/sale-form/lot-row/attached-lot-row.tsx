"use client";

import type { SaleSetupLotRowFormValues } from "@/lib/admin/sale-setup";
import {
  ConfirmActionDialog,
  KeyValueList,
  Section,
  StaffButton,
  StatusBadge,
} from "@auction/staff-ui";
import { Trash2 } from "lucide-react";

type AttachedLotRowProps = {
  row: SaleSetupLotRowFormValues;
  rowIndex: number;
  readOnly: boolean;
  pending: boolean;
  detachConfirmOpen: boolean;
  onDetachConfirmOpenChange: (open: boolean) => void;
  onDetach: () => void;
};

export function AttachedLotRow({
  row,
  rowIndex,
  readOnly,
  pending,
  detachConfirmOpen,
  onDetachConfirmOpenChange,
  onDetach,
}: AttachedLotRowProps) {
  return (
    <>
      <Section
        title={`Lot ${rowIndex + 1}`}
        action={
          <span className="flex items-center gap-2">
            <StatusBadge tone="success">In the sale</StatusBadge>
            {!readOnly ? (
              <StaffButton
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Take lot ${rowIndex + 1} out of the sale`}
                icon={<Trash2 aria-hidden />}
                disabled={pending}
                onClick={() => onDetachConfirmOpenChange(true)}
              />
            ) : null}
          </span>
        }
      >
        <KeyValueList
          items={[
            { label: "Lot", value: row.title || "Untitled lot" },
            { label: "Added from", value: "Inventory" },
          ]}
        />
      </Section>
      <ConfirmActionDialog
        open={detachConfirmOpen}
        onOpenChange={(open) => {
          if (!pending) onDetachConfirmOpenChange(open);
        }}
        title={`Take ${row.title || "this lot"} out of the sale?`}
        description="It goes back to inventory as a draft lot, with its details kept."
        confirmLabel="Take out of sale"
        loading={pending}
        onConfirm={onDetach}
      />
    </>
  );
}
