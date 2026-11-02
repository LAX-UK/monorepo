"use client";

import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Button } from "@auction/ui/lax";
import { Loader2, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * What "Try again" does: re-render this page (and clear the error boundary that shows this, when
 * one does), or go back through the step that failed.
 */
export type AccountsRetry =
  | { kind: "refresh"; reset?: () => void }
  | { kind: "link"; href: string };

type Props = { retry: AccountsRetry };

export const ACCOUNTS_UNAVAILABLE_TITLE = "We couldn't load your accounts";

const DESCRIPTION =
  "Nothing has changed: you're still using the account you chose. Try again in a moment.";

const SUPPORT_HREF = `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "I can't load my accounts on LAX Bid",
)}`;

function RefreshButton({ reset }: { reset?: (() => void) | undefined }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="primary"
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (pending) return;
        startTransition(() => {
          router.refresh();
          reset?.();
        });
      }}
      data-testid="accounts-unavailable-retry"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <RotateCw className="size-4" strokeWidth={1.75} aria-hidden />
      )}
      Try again
    </Button>
  );
}

/**
 * "We couldn't load your accounts": shown in place of a page when the person's accounts could
 * not be read. It never names an account, because it does not know which one is in use, and it
 * says plainly that nothing was changed for them.
 */
export function AccountsUnavailable({ retry }: Props) {
  return (
    <EmptyState
      size="page"
      variant="plain"
      headingLevel="h1"
      illustration="askew"
      role="alert"
      title={ACCOUNTS_UNAVAILABLE_TITLE}
      description={DESCRIPTION}
      action={
        <>
          {retry.kind === "refresh" ? (
            <RefreshButton reset={retry.reset} />
          ) : (
            <Button asChild variant="primary" data-testid="accounts-unavailable-retry">
              <Link href={retry.href} prefetch={false}>
                <RotateCw className="size-4" strokeWidth={1.75} aria-hidden />
                Try again
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <a href={SUPPORT_HREF}>Contact us</a>
          </Button>
        </>
      }
    />
  );
}
