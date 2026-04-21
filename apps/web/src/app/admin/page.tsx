import { Button } from "@/components/ui/button";
import { getAdminLotList, getAdminPaymentList } from "@/lib/data/http/admin.server";
import { BodyText, DisplayHeading, LabelCaps } from "@auction/ui";
import { Button as UiButton } from "@auction/ui/components/button";
import { KpiTile } from "@auction/ui/components/kpi-tile";
import { ChevronRight } from "lucide-react";
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

  const trend = [0.32, 0.38, 0.36, 0.44, 0.5, 0.48, 0.55] as const;

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-10">
      <header className="space-y-3 border-b border-outline-variant/10 pb-8">
        <LabelCaps className="text-lot-orange">Admin · Operations</LabelCaps>
        <DisplayHeading
          as="h1"
          className="text-4xl font-semibold text-brand-900 dark:text-on-surface"
        >
          Operations
        </DisplayHeading>
        <BodyText className="max-w-2xl text-brand-500 dark:text-on-surface-variant">
          Create and publish lots, review settlements, and process refunds when needed.
        </BodyText>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          label="Draft lots"
          value={String(draftCount)}
          trend={trend}
          trendTone="secondary"
        />
        <KpiTile
          label="Live lots"
          value={String(activeCount)}
          trend={trend}
          trendTone="primary"
          emphasize
        />
        <KpiTile
          label="Payment rows"
          value={String(paymentCount)}
          trend={trend}
          trendTone="lot-orange"
        />
      </div>

      <div className="flex flex-wrap gap-3">
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
        <UiButton variant="chevron" asChild>
          <Link href="/admin/submissions" className="inline-flex items-center gap-2 py-3">
            Submissions
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Link>
        </UiButton>
      </div>
    </div>
  );
}
