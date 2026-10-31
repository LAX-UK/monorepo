import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";

type Props = {
  account: Pick<AccountOption, "kind" | "initials">;
  /** `md` is the 32px tile of the switcher and menus; `xs` is 24px, for account tags. */
  size?: "md" | "xs";
  className?: string;
};

const SIZE = {
  md: "size-8",
  xs: "size-6",
} as const;

/**
 * An account's initials on a tile: a square in a tint of Bid navy for an organisation, a neutral
 * circle for the person's own account, so the two read apart at a glance. Initials stay at 12px
 * at every size.
 */
export function AccountTile({ account, size = "md", className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-lax text-lax-12 font-semibold tracking-[0.02em]",
        SIZE[size],
        account.kind === "organisation"
          ? cn(
              size === "xs" ? "rounded-[4px]" : "rounded-[6px]",
              "bg-product-accent/10 text-product-accent dark:bg-product-accent/20 dark:text-lax-fg",
            )
          : "rounded-full bg-lax-neutral-bg text-lax-fg",
        className,
      )}
    >
      {account.initials}
    </span>
  );
}
