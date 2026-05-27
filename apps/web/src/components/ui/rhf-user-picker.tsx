"use client";

import { UserPicker } from "@/components/admin/user-picker";
import { useFormField } from "@auction/ui/components/form";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof UserPicker>;

export function RhfUserPicker(props: Props) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const describedBy =
    error && formMessageId ? `${formDescriptionId} ${formMessageId}`.trim() : formDescriptionId;

  return (
    <UserPicker id={formItemId} aria-invalid={!!error} aria-describedby={describedBy} {...props} />
  );
}
