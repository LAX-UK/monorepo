"use client";

import { notify } from "@/lib/ui/notify";
import { StaffButton } from "@auction/staff-ui";
import { Copy } from "lucide-react";

type Props = {
  value: string;
  label: string;
};

export function AdminCopyField({ value, label }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="break-all font-mono text-staff-xs text-staff-fg">{value}</span>
      <StaffButton
        variant="secondary"
        size="sm"
        icon={<Copy aria-hidden />}
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => notify.success(`${label} copied`));
        }}
      >
        Copy
      </StaffButton>
    </div>
  );
}
