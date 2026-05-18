"use client";

import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Copy } from "lucide-react";

type Props = {
  value: string;
  label: string;
};

export function AdminCopyField({ value, label }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-mono text-xs break-all">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1 px-2"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => notify.success(`${label} copied`));
        }}
      >
        <Copy className="size-3.5" aria-hidden />
        Copy
      </Button>
    </div>
  );
}
