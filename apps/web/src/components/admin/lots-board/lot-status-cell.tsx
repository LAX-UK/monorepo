"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AtgListMarker } from "@/components/admin/atg/selling-platform-badge";
import type { LotStatus } from "@auction/types";
import Link from "next/link";

type Props = {
  lotId: string;
  status: LotStatus;
  onAtg?: boolean;
};

/** Status badge with a quick path to edit draft lots (schedule / complete cataloguing). */
export function LotStatusCell({ lotId, status, onAtg = false }: Props) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <AdminStatusBadge domain="lot" status={status} />
        {onAtg ? <AtgListMarker label="On ATG" /> : null}
      </span>
      {status === "draft" ? (
        <Link
          href={`/admin/lots/${lotId}/edit`}
          className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
        >
          Complete draft →
        </Link>
      ) : null}
    </div>
  );
}
