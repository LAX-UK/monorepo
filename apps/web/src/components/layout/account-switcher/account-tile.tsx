import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";

type Props = {
  account: Pick<AccountOption, "kind" | "initials">;
  className?: string;
};

/**
 * An account's initials on a 32px tile: a square in a tint of Bid navy for an organisation, a
 * neutral circle for the person's own account, so the two read apart at a glance.
 */
export function AccountTile({ account, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-lax font-semibold tracking-[0.02em]",
        "size-8 text-lax-12",
        account.kind === "organisation"
          ? "rounded-[6px] bg-product-accent/10 text-product-accent"
          : "rounded-full bg-lax-neutral-bg text-lax-fg",
        className,
      )}
    >
      {account.initials}
    </span>
  );
}
