import { SofCaseDetailShell } from "@/components/admin/compliance-sof-board/sof-case-detail-shell";
import { loadAdminSofCaseDetail } from "@/lib/admin/load-admin-sof-case-detail";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminSofCaseDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadAdminSofCaseDetail(id);
  if (!bundle) notFound();

  const { row, detail, canTriage, canDecide, currentUserId } = bundle;
  const success = safeDecodeAdminErrorParam(sp.success);
  const error = safeDecodeAdminErrorParam(sp.error);
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
    />
  );
}
