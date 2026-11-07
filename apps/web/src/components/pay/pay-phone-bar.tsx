"use client";

import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayAction, PayMoneyVm } from "@/lib/pay/pay-page.vm";
import { HideBottomTabBarWhileMounted } from "@/lib/shell/shell-chrome-context";
import { PayActionButton } from "./pay-action-button";

/**
 * On a phone the total and the page's one action stay in reach at the bottom, in place of the tab
 * bar. It repeats the rail's action; it is never a different one.
 */
export function PayPhoneBar({ money, action }: { money: PayMoneyVm; action: PayAction }) {
  return (
    <>
      <HideBottomTabBarWhileMounted />
      <div
        data-pay-phone-bar=""
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-lax-line bg-lax-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <p className="min-w-0 text-lax-13 text-lax-muted">
          {PAY_COPY.totalToPay}
          <span className="block truncate text-lax-18 font-semibold tabular-nums text-lax-fg">
            {money.total}
          </span>
        </p>
        <PayActionButton action={action} compact className="shrink-0" />
      </div>
    </>
  );
}
