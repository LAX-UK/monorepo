"use client";

import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { HeaderSearchTrigger } from "@/components/layout/header-search";
import { ShellUserMenu } from "@/components/layout/shell-user-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { SessionUser } from "@/lib/data/contracts";
import { Separator } from "@auction/ui/components/separator";
import type { ReactNode } from "react";

type StaffShellHeaderProps = {
  user: SessionUser;
  role: AppShellRole;
  /** Module actions injected from admin layout (notification bell, etc.). */
  actionsSlot?: ReactNode;
  /** Rare trailing overrides from ShellConfig.header.extraSlot. */
  extraSlot?: ReactNode;
};

/**
 * Staff/admin top bar: leading search + trailing actions, theme, account.
 * Order: search (left) | actions | theme | account (right).
 */
export function StaffShellHeader({ user, role, actionsSlot, extraSlot }: StaffShellHeaderProps) {
  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <HeaderSearchTrigger surface="shell" layout="both" className="w-[20.75rem] flex-none" />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {actionsSlot}
        {extraSlot}
        <ThemeToggle surface="shell" />
        <Separator orientation="vertical" className="mx-1 hidden h-4 bg-shell-stroke lg:block" />
        <ShellUserMenu user={user} role={role} />
      </div>
    </>
  );
}
