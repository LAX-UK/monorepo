import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";

type Props = {
  account: Pick<AccountOption, "kind" | "initials">;
  size?: "xs" | "sm" | "md";
  className?: string;
};

const SIZE = {
  /** Beside a line of text, as an account tag: 24px with 12px initials, the smallest type step. */
  xs: "size-6 rounded text-xs tracking-normal",
  sm: "size-8 rounded-md text-xs",
  md: "size-9 rounded-lg text-[13px]",
} as const;

/**
 * An account's initials on a square tile: Bid navy for an organisation, neutral for the person's
 * own account, so the two read apart at a glance.
 */
export function AccountTile({ account, size = "md", className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-label font-semibold tracking-wide",
        SIZE[size],
        account.kind === "organisation"
          ? "bg-secondary text-on-secondary"
          : "bg-surface-container-highest text-on-surface",
        className,
      )}
    >
      {account.initials}
    </span>
  );
}
