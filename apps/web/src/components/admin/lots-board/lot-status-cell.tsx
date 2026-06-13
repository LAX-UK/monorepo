"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { LotStatus } from "@auction/types";
import Link from "next/link";

type Props = {
  lotId: string;
  status: LotStatus;
};

/** Status badge with a quick path to edit draft lots (schedule / complete cataloguing). */
export function LotStatusCell({ lotId, status }: Props) {
  return (
    <div className="flex flex-col items-start gap-1">
      <AdminStatusBadge domain="lot" status={status} />
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
