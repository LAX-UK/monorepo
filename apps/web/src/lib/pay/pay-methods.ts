import type { PayPlan } from "@auction/types";
import { formatGbp } from "@auction/ui";
import { PAY_COPY } from "./pay-copy";

export type PayMethod = "card" | "bank_transfer";

/** One way to pay as the choice shows it: a card that cannot be chosen says why. */
export type PayMethodOption = {
  method: PayMethod;
  title: string;
  description: string;
  /** Why it cannot be chosen; `null` while it can. */
  disabledReason: string | null;
};

export type PayMethodsVm = {
  options: PayMethodOption[];
  /** The method chosen until the person picks another: card when the server allows it. */
  defaultMethod: PayMethod;
};

/** The card limit as a sentence has it: whole pounds, "£10,000". It comes from the server. */
export function cardLimitLabel(cardLimitPence: number): string {
  return formatGbp(cardLimitPence).replace(/\.00$/, "");
}

/**
 * The choice of how to pay, from the methods the server says are open for this total. Nothing
 * here decides what is allowed: a method the plan marks unavailable is shown with its reason and
 * cannot be chosen. Returns `null` when no method is open (the total is more than one online
 * payment takes).
 */
export function payMethodsVm(plan: PayPlan): PayMethodsVm | null {
  const open = (method: PayMethod) =>
    plan.methods.some((entry) => entry.method === method && entry.available);
  const defaultMethod: PayMethod | null = open("card")
    ? "card"
    : open("bank_transfer")
      ? "bank_transfer"
      : null;
  if (!defaultMethod) return null;
  return {
    defaultMethod,
    options: [
      {
        method: "card",
        title: PAY_COPY.methodCard,
        description: PAY_COPY.methodCardNote,
        disabledReason: open("card")
          ? null
          : PAY_COPY.cardLimit(cardLimitLabel(plan.cardLimitPence)),
      },
      {
        method: "bank_transfer",
        title: PAY_COPY.methodBank,
        description: PAY_COPY.methodBankNote,
        disabledReason: open("bank_transfer") ? null : PAY_COPY.overOnlineLimit,
      },
    ],
  };
}

/** Whether a method remembered from before is still one the person may choose now. */
export function usableMethod(vm: PayMethodsVm, remembered: string | null): PayMethod {
  const match = vm.options.find(
    (option) => option.method === remembered && option.disabledReason === null,
  );
  return match ? match.method : vm.defaultMethod;
}
