import { Button } from "@/components/ui/button";
import { getAdminLotList, getAdminPaymentList } from "@/lib/data/http/admin.server";
import { Card, CardContent, CardHeader, CardTitle } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default async function AdminHomePage() {
  let draftCount = 0;
  let activeCount = 0;
  let paymentCount = 0;
  try {
    const [drafts, active, payments] = await Promise.all([
      getAdminLotList({ status: "draft", limit: 100 }),
      getAdminLotList({ status: "active", limit: 100 }),
      getAdminPaymentList(),
    ]);
    draftCount = drafts.length;
    activeCount = active.length;
    paymentCount = payments.length;
  } catch {
    // overview still renders; cards show zeros
  }

  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader
        title="Operations"
        description="Create and publish lots, review settlements, and process refunds when needed."
        className="border-0 pb-0"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-label text-xs font-normal uppercase tracking-widest text-secondary">
              Draft lots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-headline text-3xl text-on-surface">{draftCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-label text-xs font-normal uppercase tracking-widest text-secondary">
              Live lots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-headline text-3xl text-on-surface">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-label text-xs font-normal uppercase tracking-widest text-secondary">
              Payment rows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-headline text-3xl text-on-surface">{paymentCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <Button variant="primary" asChild>
          <Link href="/admin/lots/new">New lot</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/admin/lots">All lots</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/admin/sales">Sales</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/admin/payments">Payments</Link>
        </Button>
      </div>
    </div>
  );
}
