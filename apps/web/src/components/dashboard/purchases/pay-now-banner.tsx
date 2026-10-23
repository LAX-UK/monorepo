import type { PayNowVm } from "@/lib/data/view-models/dashboard-portfolio.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type PayNowBannerProps = {
  payNow: PayNowVm;
};

/**
 * Pinned above everything else on Purchases while a won lot is unpaid. When every due lot is
 * held for review there is nothing to pay yet, so it explains that instead of offering a button.
 */
export function PayNowBanner({ payNow }: PayNowBannerProps) {
  const lots = payNow.dueCount === 1 ? "1 lot" : `${payNow.dueCount} lots`;
  return (
    <section aria-label="Payment due">
      <Alert
        variant="warning"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <AlertTitle>Payment due: {payNow.outstandingLabel}</AlertTitle>
          <AlertDescription>
            {payNow.href
              ? `${lots} won and waiting for payment.`
              : `${lots} won. We are reviewing your account before you can pay; details are on each lot.`}
          </AlertDescription>
        </div>
        {payNow.href ? (
          <Button variant="primary" asChild className="min-h-11 shrink-0">
            <Link href={payNow.href}>Pay now</Link>
          </Button>
        ) : null}
      </Alert>
    </section>
  );
}
