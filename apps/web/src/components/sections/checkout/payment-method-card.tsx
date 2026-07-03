"use client";

import { settlementsEmailDisplay, settlementsPhone } from "@/lib/checkout/settlements-contact";
import { Card, CardContent } from "@auction/ui/components/card";

type Props = {
  checkoutRail: "card" | "gb_bank_transfer" | null;
};

export function paymentMethodCopy(checkoutRail: Props["checkoutRail"]): string {
  if (checkoutRail === "gb_bank_transfer") {
    return "This purchase settles by UK bank transfer via secure Stripe Checkout — card is not available above our card limit. High-value purchases may require finance review before checkout is issued.";
  }
  if (checkoutRail === "card") {
    return "Pay by card via secure Stripe Checkout.";
  }
  return "Pay by card or UK bank transfer via secure Stripe Checkout, depending on the amount. High-value purchases may require finance review before checkout is issued.";
}

export function PaymentMethodCard({ checkoutRail }: Props) {
  return (
    <Card className="min-w-0 border border-border-hairline bg-surface-container-high/40 shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <h2 className="mb-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Payment
        </h2>
        <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
          {paymentMethodCopy(checkoutRail)}
        </p>
        <p className="font-body text-sm text-on-surface">
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Concierge
          </span>
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
