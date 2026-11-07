"use client";

import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayAction } from "@/lib/pay/pay-page.vm";
import { Button, ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { usePaySession } from "./pay-session";

/**
 * The page's one action: Pay, or the step that clears what stands in the way. The same element
 * serves the rail and the phone bar.
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
  const { pay, pending } = usePaySession();
  if (action.kind === "link") {
    return (
      <ButtonLink href={action.href} Link={Link} variant="primary" size="lg" className={className}>
        {action.label}
      </ButtonLink>
    );
  }
  return (
    <Button
      variant="primary"
      size="lg"
      className={className}
      loading={pending}
      // The bar shows the total beside a short label; assistive technology still reads the amount.
      {...(compact && !pending ? { "aria-label": action.label } : {})}
      onClick={() => pay(action)}
    >
      {pending ? PAY_COPY.opening : compact ? action.barLabel : action.label}
    </Button>
  );
}
