"use client";

import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { SwitchConfirmation as SwitchConfirmationVm } from "@/lib/navigation/switch-confirmation.vm";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Button } from "@auction/ui/lax";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccountTile } from "./account-tile";

type Props = {
  confirmation: SwitchConfirmationVm;
  /** The account to switch to and the page to open, posted to the switch hop. */
  accountId: string;
  next: string;
};

/**
 * "Open this as Northbank Gallery?": a link from another site (an email, a message) would change
 * the account in use, so the person chooses. Continuing posts to the switch hop (a plain form, so
 * it works before scripts load); staying keeps the current account and goes to its Home.
 */
export function SwitchConfirmation({ confirmation, accountId, next }: Props) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <EmptyState
      size="page"
      variant="plain"
      headingLevel="h1"
      illustration={<AccountTile account={confirmation.tile} />}
      title={confirmation.title}
      description={confirmation.description}
      action={
        <form
          method="post"
          action={CLIENT_ROUTES.accountSwitch}
          onSubmit={(event) => {
            if (submitting) event.preventDefault();
            else setSubmitting(true);
          }}
          className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <input type="hidden" name="to" value={accountId} />
          <input type="hidden" name="next" value={next} />
          <Button
            type="submit"
            variant="primary"
            aria-busy={submitting || undefined}
            aria-disabled={submitting || undefined}
            data-testid="switch-confirm-continue"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmation.continueLabel}
          </Button>
          <Button asChild variant="secondary">
            <Link href={CLIENT_ROUTES.home}>{confirmation.stayLabel}</Link>
          </Button>
        </form>
      }
    />
  );
}
