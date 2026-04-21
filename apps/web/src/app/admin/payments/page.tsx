import {
  type AdminPaymentTableRow,
  AdminPaymentsDataTable,
} from "@/components/admin/admin-payments-data-table";
import { TableScroll } from "@/components/ui/table-scroll";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminLotList, getAdminPaymentList } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

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
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <DisplayHeading as="h1" className="text-4xl text-brand-900 dark:text-on-surface">
        Payments
      </DisplayHeading>

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load payments</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {payments.length === 0 && !loadError ? (
        <p className="text-on-surface-variant">No payment records yet.</p>
      ) : loadError ? null : (
        <TableScroll>
          <AdminPaymentsDataTable rows={paymentRows} />
        </TableScroll>
      )}
    </div>
  );
}
