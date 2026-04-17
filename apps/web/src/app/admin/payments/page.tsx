import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { DisplayHeading } from "@/components/ui/typography";
import { adminRefundPaymentAction } from "@/lib/actions/admin";
import { getAdminAuctionList, getAdminPaymentList } from "@/lib/data/http/admin.server";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  let payments: Awaited<ReturnType<typeof getAdminPaymentList>> = [];
  let auctions: Awaited<ReturnType<typeof getAdminAuctionList>> = [];
  let loadError: string | null = null;
  try {
    const [p, a] = await Promise.all([
      getAdminPaymentList(),
      getAdminAuctionList({ limit: 200, offset: 0 }),
    ]);
    payments = p;
    auctions = a;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load payments.";
  }

  const titleById = new Map(auctions.map((a) => [a.id, a.title]));

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
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Lot</TableHeaderCell>
              <TableHeaderCell>Buyer</TableHeaderCell>
              <TableHeaderCell>Amount</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{titleById.get(p.auctionId) ?? p.auctionId}</TableCell>
                <TableCell className="max-w-[10rem] truncate font-mono text-xs">
                  {p.buyerId}
                </TableCell>
                <TableCell className="tabular-nums">{p.amount}</TableCell>
                <TableCell>{p.status}</TableCell>
                <TableCell className="text-right">
                  {p.status === "refunded" ? (
                    <span className="text-on-surface-variant">Refunded</span>
                  ) : (
                    <form action={adminRefundPaymentAction} className="inline">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button
                        type="submit"
                        className="font-label text-xs uppercase tracking-widest text-error underline-offset-2 hover:underline"
                      >
                        Refund
                      </button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
