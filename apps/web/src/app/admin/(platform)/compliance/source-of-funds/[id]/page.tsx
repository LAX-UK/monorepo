import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SofCaseDetailClient } from "@/components/admin/compliance-sof-board/sof-case-detail-client";
import { loadAdminSofCaseDetail } from "@/lib/admin/load-admin-sof-case-detail";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import Link from "next/link";
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
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/admin/compliance/source-of-funds" className="text-link underline">
            ← Source of Funds
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-headline text-xl font-semibold text-on-surface">
            <Link href={`/admin/clients/${row.userId}`} className="text-link hover:underline">
              {buyerLabel}
            </Link>
          </h1>
          <AdminStatusBadge domain="sofCase" status={row.displayStatus} />
        </div>
        <p className="text-sm text-on-surface-variant">
          {row.triggerLabel} · {row.exposureLabel} · Opened {row.openedLabel}
        </p>
      </div>

      <SofCaseDetailClient
        row={row}
        detail={detail}
        canTriage={canTriage}
        canDecide={canDecide}
        currentUserId={currentUserId}
        success={success}
        error={error}
      />
    </div>
  );
}
