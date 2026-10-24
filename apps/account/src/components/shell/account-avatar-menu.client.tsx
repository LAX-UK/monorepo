"use client";

import { Button } from "@auction/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { AccountAvatar } from "./account-avatar";
import type { AccountViewer } from "./account-viewer";
import { SignOutForm } from "./sign-out-form";

/**
 * The avatar in the header opens the person's name, email and Sign out, the same entry the other
 * LAX headers keep for the account. The popover moves focus inside and closes on Escape.
 */
export function AccountAvatarMenu({ viewer }: { viewer: AccountViewer }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Account menu for ${viewer.displayName}`}
          className="min-h-11 min-w-11 rounded-full"
        >
          <AccountAvatar viewer={viewer} className="size-9" textClassName="text-xs" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex w-72 flex-col gap-4 border-border-hairline bg-surface p-4"
      >
        <div className="flex items-center gap-3">
          <AccountAvatar viewer={viewer} className="size-11" textClassName="text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-on-surface">{viewer.displayName}</p>
            {viewer.name && viewer.email ? (
              <p className="truncate text-xs text-on-surface-variant">{viewer.email}</p>
            ) : null}
          </div>
        </div>
        <SignOutForm />
      </PopoverContent>
    </Popover>
  );
}
