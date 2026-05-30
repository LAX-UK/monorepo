"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { Badge } from "@auction/ui";
import Link from "next/link";

type Props = {
  readiness: CatalogReadinessResult;
  setupHref: string;
};

/** Draft sale setup progress chip linking to the setup wizard. */
export function SaleSetupProgressChip({ readiness, setupHref }: Props) {
  return (
    <Link href={setupHref} className="inline-flex">
      <Badge
        variant={readiness.percent === 100 ? "secondary" : "outline"}
        className="min-h-8 gap-1 px-2.5 font-label text-[10px] uppercase tracking-[0.12em]"
      >
        Setup {readiness.percent}%
      </Badge>
    </Link>
  );
}
