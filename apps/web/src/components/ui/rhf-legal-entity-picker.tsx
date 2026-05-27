"use client";

import {
  AdminLegalEntityPicker,
  type AdminLegalEntityPickerProps,
} from "@/components/admin/admin-legal-entity-picker";

type Props = AdminLegalEntityPickerProps;

/** Legal entity picker wired for react-hook-form `FormField` + `FormItem`. */
export function RhfLegalEntityPicker(props: Props) {
  return <AdminLegalEntityPicker {...props} />;
}
