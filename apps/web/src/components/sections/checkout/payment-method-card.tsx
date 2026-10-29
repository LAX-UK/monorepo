"use client";

import { settlementsEmailDisplay, settlementsPhone } from "@/lib/checkout/settlements-contact";
import { Card, CardContent } from "@auction/ui/components/card";

type Props = {
  checkoutRail: "card" | "gb_bank_transfer" | null;
};

export function paymentMethodCopy(checkoutRail: Props["checkoutRail"]): string {
  if (checkoutRail === "gb_bank_transfer") {
    return "This purchase is paid by UK bank transfer through our secure checkout, as it is above our card limit. For high-value purchases, our team checks the payment before checkout opens.";
  }
  if (checkoutRail === "card") {
    return "Pay by card through our secure checkout.";
  }
  return "Pay by card or UK bank transfer through our secure checkout, depending on the amount. For high-value purchases, our team checks the payment before checkout opens.";
}

export function PaymentMethodCard({ checkoutRail }: Props) {
  return (
    <Card className="min-w-0 border border-border-hairline bg-surface-container-high/40 shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <h2 className="mb-4 font-label text-xs font-bold text-secondary">Payment</h2>
        <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
          {paymentMethodCopy(checkoutRail)}
        </p>
        <p className="font-body text-sm text-on-surface">
          <span className="font-label text-xs text-secondary">Concierge</span>
          <br />
          <span className="break-all">{settlementsEmailDisplay()}</span>
          {settlementsPhone() ? (
            <>
              <br />
              <span className="text-on-surface-variant">{settlementsPhone()}</span>
            </>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}
