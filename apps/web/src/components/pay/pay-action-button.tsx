"use client";

import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayMethod } from "@/lib/pay/pay-methods";
import type { PayAction } from "@/lib/pay/pay-page.vm";
import { Button, ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { usePaySession } from "./pay-session";

/**
 * The page's one action: Pay (worded for the way the person chose to pay), or the step that
 * clears what stands in the way. The same element serves the rail and the phone bar.
 */
export function PayActionButton({
  action,
  className,
  compact = false,
}: {
  action: PayAction;
  className?: string;
  /** The total is shown beside the button, so the label need not repeat it. */
  compact?: boolean;
}) {
  const { pay, pending, method, afterReturn } = usePaySession();
  if (action.kind === "link") {
    return (
      <ButtonLink href={action.href} Link={Link} variant="primary" size="lg" className={className}>
        {action.label}
      </ButtonLink>
    );
  }
  const words = actionWords(action, method, afterReturn);
  return (
    <Button
      variant="primary"
      size="lg"
      className={className}
      loading={pending}
      // The bar shows the total beside a short label; assistive technology still reads the amount.
      {...(compact && !pending ? { "aria-label": words.label } : {})}
      onClick={() => pay(action)}
    >
      {pending ? PAY_COPY.opening : compact ? words.barLabel : words.label}
    </Button>
  );
}

/**
 * What the action says: the words for the way the person chose to pay, except that a card action
 * reads Try again while the page still shows the not-completed note from the return.
 */
export function actionWords(
  action: Extract<PayAction, { kind: "pay" }>,
  method: PayMethod,
  afterReturn: boolean,
): { label: string; barLabel: string } {
  const chosen = action.byMethod[method];
  const again = action.byMethod.card.retry;
  return method === "card" && afterReturn && again ? again : chosen;
}

/** The sentence under the action, for the way the person chose to pay. */
export function PayActionNote({ action }: { action: Extract<PayAction, { kind: "pay" }> }) {
  const { method } = usePaySession();
  return <p className="text-lax-13 text-lax-muted">{action.byMethod[method].note}</p>;
}
