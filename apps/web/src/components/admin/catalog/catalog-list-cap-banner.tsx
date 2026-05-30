import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

/** Inline notice when a list view hits a server-side row cap (e.g. pipeline mode). */
export function CatalogListCapBanner({ message, actionHref, actionLabel }: Props) {
  return (
    <Alert variant="default" className="border-outline-variant/40 bg-surface-container-low">
      <AlertDescription className="flex flex-col gap-3 font-body text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {actionHref && actionLabel ? (
          <Button variant="secondary" size="sm" className="min-h-10 shrink-0" asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
