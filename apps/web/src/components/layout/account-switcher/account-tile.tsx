import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";

type Props = {
  account: Pick<AccountOption, "kind" | "initials">;
  size?: "xs" | "sm" | "md";
  className?: string;
};

/** Initials stay at 12px, the smallest type step, at every size. */
const SIZE = {
  /** Beside a line of text, as an account tag. */
  xs: "size-6",
  /** In a toast. */
  sm: "size-7",
  /** The switcher, its rows and menus. */
  md: "size-8",
} as const;

/**
 * An account's initials on a tile: a square in a tint of Bid navy for an organisation, a neutral
 * circle for the person's own account, so the two read apart at a glance.
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
              size === "md" ? "rounded-[6px]" : "rounded-[4px]",
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
