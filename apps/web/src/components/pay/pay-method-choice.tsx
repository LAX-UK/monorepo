"use client";

import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayMethodsVm } from "@/lib/pay/pay-methods";
import { PresetCards } from "@auction/ui/lax/preset-cards";
import { usePaySession } from "./pay-session";

/**
 * How to pay: card or UK bank transfer, as radio cards. Which can be chosen is the server's call;
 * a card the total is too large for is shown with the server's limit as its reason, never hidden.
 */
export function PayMethodChoice({ methods }: { methods: PayMethodsVm }) {
  const { method, chooseMethod, pending } = usePaySession();
  return (
    <div className="mt-5 border-t border-lax-line-subtle pt-5">
      <h3 className="mb-3 text-lax-14 font-semibold text-lax-fg">{PAY_COPY.howYouPay}</h3>
      <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
        <PresetCards
          label={PAY_COPY.howYouPay}
          columns={1}
          compact
          value={method}
          onValueChange={chooseMethod}
          options={methods.options.map((option) => ({
            value: option.method,
            label: option.title,
            description: option.description,
            ...(option.disabledReason ? { disabledReason: option.disabledReason } : {}),
          }))}
        />
      </fieldset>
    </div>
  );
}
