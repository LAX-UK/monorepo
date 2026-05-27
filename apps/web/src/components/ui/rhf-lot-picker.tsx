"use client";

import { AdminLotPicker, type AdminLotPickerProps } from "@/components/admin/admin-lot-picker";
import { useFormField } from "@auction/ui/components/form";

type Props = AdminLotPickerProps;

export function RhfLotPicker(props: Props) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const describedBy =
    error && formMessageId ? `${formDescriptionId} ${formMessageId}`.trim() : formDescriptionId;

  return (
    <AdminLotPicker
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      {...props}
    />
  );
}
