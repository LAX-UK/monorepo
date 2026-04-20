import {
  type AdminPaymentTableRow,
  AdminPaymentsDataTable,
} from "@/components/admin/admin-payments-data-table";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminLotList, getAdminPaymentList } from "@/lib/data/http/admin.server";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

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

  const paymentRows: AdminPaymentTableRow[] = payments.map((p) => ({
    id: p.id,
    lotId: p.lotId,
    lotTitle: titleById.get(p.lotId) ?? p.lotId,
    buyerId: p.buyerId,
    sellerId: p.sellerId,
    amount: p.amount,
    platformFee: p.platformFee,
    status: p.status,
  }));

  return (
    <div className="max-w-6xl space-y-8">
      <DisplayHeading as="h1" className="text-4xl">
        Payments
      </DisplayHeading>

      {(error || loadError) && (
        <div
          className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {loadError ?? error}
        </div>
      )}

      {payments.length === 0 && !loadError ? (
        <p className="text-on-surface-variant">No payment records yet.</p>
      ) : (
        <AdminPaymentsDataTable rows={paymentRows} />
      )}
    </div>
  );
}
