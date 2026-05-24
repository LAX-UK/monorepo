"use client";

import { WorkspaceModeSwitcher } from "@/components/dashboard/workspace-mode-switcher";
import type { AppShellNavItem } from "@/components/layout/app-shell-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DensityTweakSection } from "@/components/layout/tweaks-popover";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import Link from "next/link";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientWorkspaceMode: ClientWorkspaceMode;
  items: AppShellNavItem[];
};

export function ClientMobileMoreSheet({ open, onOpenChange, clientWorkspaceMode, items }: Props) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="border-outline-variant bg-surface-container-lowest">
        <BottomSheetHeader className="px-6 pt-2 pb-1 text-left">
          <BottomSheetTitle className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            More
          </BottomSheetTitle>
        </BottomSheetHeader>
        <div className="space-y-5 px-6 pt-4 pb-6">
          <WorkspaceModeSwitcher mode={clientWorkspaceMode} variant="inline" />
          {items.length > 0 ? (
            <nav aria-label="More dashboard destinations" className="grid gap-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="flex min-h-12 items-center gap-3 rounded-lg border border-border-hairline bg-surface-container-low/40 px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-high"
                  >
                    <Icon className="size-4 text-primary" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          <div className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
            <DensityTweakSection />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
            <div>
              <p className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                Dark mode
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">Toggle the colour scheme.</p>
            </div>
            <ThemeToggle />
          </div>
          <LogoutButton className="min-h-11 w-full justify-center rounded-md border border-border-hairline px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-high" />
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
