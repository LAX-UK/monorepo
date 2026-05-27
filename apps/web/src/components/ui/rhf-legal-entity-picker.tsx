"use client";

import {
  AdminLegalEntityPicker,
  type AdminLegalEntityPickerProps,
} from "@/components/admin/admin-legal-entity-picker";
import { useFormField } from "@auction/ui/components/form";

type Props = AdminLegalEntityPickerProps;

/** Legal entity picker wired for react-hook-form `FormField` + `FormItem`. */
export function RhfLegalEntityPicker(props: Props) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const describedBy =
    error && formMessageId ? `${formDescriptionId} ${formMessageId}`.trim() : formDescriptionId;

  return (
    <AdminLegalEntityPicker
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      {...props}
    />
  );
}
