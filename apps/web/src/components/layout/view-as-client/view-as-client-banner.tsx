import { endAdminImpersonationAction } from "@/lib/legal-entity/acting-context.actions";
import { Button } from "@auction/ui/components/button";
import { Eye } from "lucide-react";

/** The id of the sentence that explains why actions are off; disabled controls point to it. */
export const READ_ONLY_REASON_ID = "view-as-client-reason";

type Props = {
  /** The account support is looking at. */
  accountName: string;
};

/**
 * Shown while support staff view Bid as a client. It stays at the top of every page, says whose
 * account it is and that nothing can be changed, and ends the session with Exit.
 */
export function ViewAsClientBanner({ accountName }: Props) {
  return (
    <div
      className="flex h-[var(--view-as-client-banner-height)] shrink-0 items-center bg-inverse-surface px-4 text-inverse-on-surface sm:px-8"
      data-testid="view-as-client-banner"
    >
      <div className="mx-auto flex w-full max-w-[var(--container-inner,1376px)] items-center gap-3">
        <Eye className="size-4 shrink-0" aria-hidden />
        <p className="flex min-w-0 flex-1 items-baseline font-body text-sm leading-snug">
          <span className="truncate font-semibold">Viewing as {accountName}</span>
          <span className="shrink-0 whitespace-pre font-semibold"> — read-only</span>
          {/* On a phone the title says it; the reason stays for assistive technology. */}
          <span
            id={READ_ONLY_REASON_ID}
            className="sr-only truncate text-xs opacity-80 sm:not-sr-only sm:ml-2"
          >
            Actions are turned off while you view as this client.
          </span>
        </p>
        <form action={endAdminImpersonationAction} className="shrink-0">
          <Button
            type="submit"
            size="default"
            variant="outline"
            className="border-inverse-on-surface/40 bg-transparent text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface focus-visible:ring-inverse-on-surface focus-visible:ring-offset-inverse-surface"
          >
            Exit
          </Button>
        </form>
      </div>
    </div>
  );
}
