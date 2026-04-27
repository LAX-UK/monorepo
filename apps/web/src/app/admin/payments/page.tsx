import { AdminPaymentsBoard } from "@/components/admin/admin-payments-board";
import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { getAdminLotList, getAdminPaymentList } from "@/lib/data/http/admin.server";
import type { PaymentStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

const statusFilters = ["all", "pending", "authorized", "captured", "refunded"] as const;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const statusParam = sp.status;
  const statusFilter: PaymentStatus | undefined =
    statusParam === "pending" ||
    statusParam === "authorized" ||
    statusParam === "captured" ||
    statusParam === "refunded"
      ? statusParam
      : undefined;

  let payments: Awaited<ReturnType<typeof getAdminPaymentList>> = [];
  let auctions: Awaited<ReturnType<typeof getAdminLotList>> = [];
  let loadError: string | null = null;
  try {
    const [p, a] = await Promise.all([
      getAdminPaymentList(),
      getAdminLotList({ limit: 200, offset: 0 }),
    ]);
    payments = p;
    auctions = a;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load payments.";
  }

  const titleById = new Map(auctions.map((a) => [a.id, a.title]));

  const paymentRows: AdminPaymentTableRow[] = payments
    .map((p) => ({
      id: p.id,
      lotId: p.lotId,
      lotTitle: titleById.get(p.lotId) ?? p.lotId,
      buyerId: p.buyerId,
      sellerId: p.sellerId,
      amount: p.amount,
      platformFee: p.platformFee,
      status: p.status,
      xeroInvoiceNumber: p.xeroInvoiceNumber,
      xeroOnlineInvoiceUrl: p.xeroOnlineInvoiceUrl,
      xeroSyncStatus: p.xeroSyncStatus,
      xeroLastError: p.xeroLastError,
    }))
    .filter((row) => !statusFilter || row.status === statusFilter);

  const statusChips = (
    <fieldset className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto border-0 p-0 pb-1 sm:flex-wrap sm:overflow-visible">
      <legend className="sr-only">Filter by payment status</legend>
      {statusFilters.map((s) => {
        const qs = new URLSearchParams();
        if (s !== "all") qs.set("status", s);
        const href = qs.toString() ? `/admin/payments?${qs.toString()}` : "/admin/payments";
        const active = (s === "all" && !statusFilter) || sp.status === s;
        return (
          <Link
            key={s}
            href={href}
            className={`shrink-0 snap-start rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
              active
                ? "bg-primary text-on-primary ring-primary"
                : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
            }`}
          >
            {s}
          </Link>
        );
      })}
    </fieldset>
  );

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <PageHeader
        title="Payments"
        description="Filter by status, search loaded rows, and use the drawer for capture/refund on touch devices."
      />

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load payments</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {payments.length === 0 && !loadError ? (
        <p className="text-on-surface-variant">No payment records yet.</p>
      ) : loadError ? null : (
        <AdminPaymentsBoard rows={paymentRows} statusChips={statusChips} />
      )}
    </div>
  );
}
