"use client";

import {
  AsyncCombobox,
  type AsyncComboboxHit,
  type AsyncComboboxProps,
} from "@auction/ui/components/async-combobox";
import { useFormField } from "@auction/ui/components/form";

type Props<THit extends AsyncComboboxHit> = Omit<AsyncComboboxProps<THit>, "value" | "onChange"> & {
  value: string | null;
  onChange: (id: string | null, hit?: THit) => void;
};

export function RhfAsyncCombobox<THit extends AsyncComboboxHit>({
  value,
  onChange,
  onBlur,
  ...rest
}: Props<THit>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const describedBy =
    error && formMessageId ? `${formDescriptionId} ${formMessageId}`.trim() : formDescriptionId;

  return (
    <AsyncCombobox
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      value={value}
      onChange={onChange}
      {...(onBlur ? { onBlur } : {})}
      {...rest}
    />
  );
}
