import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default function SellerInSalePage() {
  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Items in sale"
        description="Lots originating from your submissions appear here with reserve indicators and public catalogue links—never bidder identities."
        className="border-0 pb-0"
      />
      <EmptyState
        title="Seller catalogue view is wiring up"
        description="We are connecting submission conversions to live catalogue rows. Until then, approved items surface under Submissions as “converted” with links to the admin-published lot."
        action={
          <Button variant="secondary" asChild>
            <Link href="/dashboard/submissions?status=converted">View converted submissions</Link>
          </Button>
        }
      />
    </div>
  );
}
