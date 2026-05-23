import { LotDetailShell } from "@/components/admin/lot-detail/lot-detail-shell";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminLotDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const bundle = await loadAdminLotDetail(id);
  const bids = await getServerLotBids(id, 100).catch(() => []);

  return (
    <LotDetailShell lotId={id} bundle={bundle} bidCount={bids.length}>
      {children}
    </LotDetailShell>
  );
}
