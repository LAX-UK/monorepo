"use client";

import { CopyButton } from "@auction/staff-ui";

type Props = {
  value: string;
  label: string;
};

export function AdminCopyField({ value, label }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="break-all font-mono text-staff-xs text-staff-fg">{value}</span>
      <CopyButton value={value} label={label} />
    </div>
  );
}
