import { SofCaseDetailShell } from "@/components/admin/compliance-sof-board/sof-case-detail-shell";
import { resolveAdminNotice } from "@/lib/admin/admin-notice";
import { loadSofCaseDetailPage } from "@/lib/admin/compliance/load-sof-case-detail-page";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; returnTo?: string }>;
};

export default async function AdminSofCaseDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadSofCaseDetailPage(id);
  if (!bundle) notFound();

  const { row, detail, canTriage, canDecide, currentUserId } = bundle;
  const { success, error } = resolveAdminNotice(sp.notice);
  const buyerLabel = detail.buyer.label ?? detail.buyer.email ?? "Buyer";

  return (
    <SofCaseDetailShell
      row={row}
      detail={detail}
      buyerLabel={buyerLabel}
      canTriage={canTriage}
      canDecide={canDecide}
      currentUserId={currentUserId}
      success={success}
      error={error}
      returnTo={sp.returnTo}
    />
  );
}
