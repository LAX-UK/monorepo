"use client";

import {
  type AccountChrome,
  type AccountOption,
  pendingInvitationsLabel,
} from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Check, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { AccountTile } from "./account-tile";

type Switcher = NonNullable<AccountChrome["switcher"]>;

type Props = {
  switcher: Switcher;
  /** The account being switched to, while the switch is in flight. */
  pendingId: string | null;
  onChoose: (option: AccountOption) => void;
  /** Called when a footer link is followed, so the menu can close. */
  onNavigate: () => void;
  /** Sheet rows are taller, for thumbs. */
  density?: "popover" | "sheet";
};

const ROW =
  "flex w-full items-center justify-start gap-3 whitespace-normal rounded-lg px-3 text-left font-normal transition-colors hover:bg-surface-container-low disabled:cursor-wait";

/**
 * The accounts someone can use Bid as, the current one ticked, then a way to answer invitations
 * and to register an organisation. Shared by the desktop popover and the phone sheet.
 */
export function AccountSwitcherList({
  switcher,
  pendingId,
  onChoose,
  onNavigate,
  density = "popover",
}: Props) {
  const headingId = useId();
  const rowHeight = density === "sheet" ? "min-h-14 py-2.5" : "min-h-12 py-2";
  return (
    <div className="flex flex-col">
      <p className="px-4.5 pt-3 pb-1.5 font-body text-xs text-on-surface-variant" id={headingId}>
        Switch account
      </p>
      <ul className="flex flex-col gap-0.5 px-1.5" aria-labelledby={headingId}>
        {switcher.options.map((option) => {
          const pending = pendingId === option.id;
          return (
            <li key={option.id}>
              <Button
                variant="ghost"
                size="link"
                type="button"
                onClick={() => onChoose(option)}
                disabled={pendingId !== null}
                aria-current={option.current ? "true" : undefined}
                className={cn(ROW, rowHeight, option.current && "bg-surface-container-low")}
                data-testid={`switch-account-${option.kind}`}
              >
                <AccountTile account={option} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-sm font-medium text-on-surface">
                    {option.name}
                  </span>
                  <span className="block truncate font-body text-xs text-on-surface-variant">
                    {option.detail}
                  </span>
                </span>
                {pending ? (
                  <Loader2
                    className="size-4 shrink-0 animate-spin text-on-surface-variant"
                    aria-hidden
                  />
                ) : option.current ? (
                  <Check className="size-4 shrink-0 text-secondary" strokeWidth={2} aria-hidden />
                ) : null}
                {option.current ? <span className="sr-only">(current account)</span> : null}
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="mx-1.5 mt-1.5 border-t border-border-hairline py-1.5">
        {switcher.pendingInvitations > 0 ? (
          <Link
            href={switcher.invitationsHref}
            onClick={onNavigate}
            className={cn(ROW, "min-h-11 justify-between font-body text-sm text-on-surface")}
          >
            <span className="sr-only">{pendingInvitationsLabel(switcher.pendingInvitations)}</span>
            <span aria-hidden>Pending invitations</span>
            <span
              aria-hidden
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-high px-1.5 font-label text-xs font-medium tabular-nums text-on-surface"
            >
              {switcher.pendingInvitations > 9 ? "9+" : switcher.pendingInvitations}
            </span>
          </Link>
        ) : null}
        <Link
          href={switcher.registerHref}
          onClick={onNavigate}
          className={cn(ROW, "min-h-11 justify-between font-body text-sm text-on-surface")}
        >
          Register an organisation
          <Plus
            className="size-4 shrink-0 text-on-surface-variant"
            strokeWidth={1.75}
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}
