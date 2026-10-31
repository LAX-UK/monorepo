"use client";

import { ActingAsTooltip } from "@/components/layout/acting-as-tooltip";
import { type AccountChrome, accountRowText } from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { AccountSwitcherPopover } from "./account-switcher-popover";
import { AccountTile } from "./account-tile";

/** Past about this many characters a name can need more than the card's two lines. */
const LONG_NAME = 36;

type Props = {
  account: AccountChrome;
  /** The sidebar is collapsed to icons, so only the tile shows. */
  collapsed?: boolean;
  /** Show the one-time "switch between your accounts" hint. */
  showHint?: boolean;
};

/**
 * The account switcher at the top of the Bid menu: the account in use (initials, name, the
 * person's role) and, on click, every account they can switch to. People with no organisation
 * have one account, so there is nothing to render.
 */
export function AccountSwitcher({ account, collapsed = false, showHint = false }: Props) {
  const { switcher, current } = account;
  if (!switcher) return null;
  const { title, caption } = accountRowText(current);

  const switcherButton = (
    <div className="relative">
      <AccountSwitcherPopover
        switcher={switcher}
        side={collapsed ? "right" : "bottom"}
        trigger={(pendingId) => (
          <Button
            variant="ghost"
            size="link"
            type="button"
            aria-label={`Account: ${title}, ${caption}. Switch account`}
            data-testid="account-switcher"
            className={cn(
              "lax-focus flex w-full items-center justify-start gap-3 whitespace-normal rounded-lax-menu border border-lax-line bg-lax-surface text-left font-normal transition-colors duration-150",
              "hover:border-lax-line-strong hover:bg-lax-surface",
              "data-[state=open]:border-lax-line-strong",
              collapsed ? "justify-center p-1.5" : "min-h-14 py-2 pr-2 pl-2",
            )}
          >
            {pendingId ? (
              <span className="inline-flex size-8 shrink-0 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-lax-muted" aria-hidden />
              </span>
            ) : (
              <AccountTile account={current} />
            )}
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1">
                  {/* The account's name is the one identity in the chrome: it wraps to two lines,
                      and only a longer name is cut, with the whole name on hover. */}
                  <span
                    className="line-clamp-2 text-lax-14 font-semibold break-words text-lax-fg"
                    {...(title.length > LONG_NAME ? { title } : {})}
                  >
                    {title}
                  </span>
                  {/* The role and state ("Owner · Documents requested") wrap rather than cut. */}
                  <span className="block text-lax-12 text-pretty text-lax-muted">{caption}</span>
                </span>
                <ChevronsUpDown
                  className="size-4 shrink-0 text-lax-muted"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </>
            )}
          </Button>
        )}
      />
    </div>
  );
  // The hint points at the full switcher; a sidebar collapsed to icons has no room for it.
  if (collapsed) return switcherButton;
  return <ActingAsTooltip initiallyVisible={showHint}>{switcherButton}</ActingAsTooltip>;
}
