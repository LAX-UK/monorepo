"use client";

import { Button } from "@auction/ui/components/button";
import { Download } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  /** Base path for export (defaults to current pathname). */
  basePath?: string;
  className?: string;
};

/** Appends `export=csv` to the current list query for server-side CSV handlers. */
export function AdminListExportLink({ basePath, className }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("export", "csv");
    const path = basePath ?? pathname;
    const qs = params.toString();
    return qs ? `${path}?${qs}` : `${path}?export=csv`;
  })();

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={className ?? "min-h-9 gap-1.5 font-label text-xs"}
    >
      <a href={href} download>
        <Download className="size-4" aria-hidden />
        Export CSV
      </a>
    </Button>
  );
}
