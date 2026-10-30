"use client";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@auction/ui/components/dropdown-menu";
import { Keyboard, LogOut, Monitor, Moon, Sun } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import {
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import { useStaffShortcuts } from "./shortcuts.js";
import type { StaffTheme, StaffUser } from "./types.js";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}

const THEMES: ReadonlyArray<{ value: StaffTheme; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Light", icon: <Sun aria-hidden /> },
  { value: "dark", label: "Dark", icon: <Moon aria-hidden /> },
  { value: "system", label: "Match system", icon: <Monitor aria-hidden /> },
];

/**
 * Who is signed in, their role, the theme, keyboard shortcuts and sign out. Further links (LAX
 * Account, help) come from the app as `children`.
 */
export function AccountMenu({
  user,
  theme,
  onThemeChange,
  onSignOut,
  signOutHref,
  children,
}: {
  user: StaffUser;
  theme?: StaffTheme;
  onThemeChange?: (theme: StaffTheme) => void;
  onSignOut?: () => void;
  /** Sign out as a link (a route that clears the session). */
  signOutHref?: string;
  children?: React.ReactNode;
}) {
  const shortcuts = useStaffShortcuts();
  return (
    <StaffMenu>
      <StaffMenuTrigger
        aria-label={`Account: ${user.name}`}
        className={cn(
          "staff-focus staff-target flex h-control-sm items-center gap-2 rounded-staff-sm pr-2 pl-1 transition-colors",
          "hover:bg-staff-hover data-[state=open]:bg-staff-pressed",
        )}
      >
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-staff-neutral-bg text-staff-2xs font-semibold text-staff-neutral-fg ring-1 ring-staff-line ring-inset"
        >
          {initialsOf(user.name)}
        </span>
        <span className="hidden max-w-40 truncate text-staff-sm font-medium text-staff-fg md:inline">
          {user.name}
        </span>
      </StaffMenuTrigger>
      <StaffMenuContent className="w-64">
        <div className="px-2 py-2">
          <p className="truncate text-staff-sm font-medium text-staff-fg">{user.name}</p>
          {user.email ? (
            <p className="truncate text-staff-xs text-staff-muted">{user.email}</p>
          ) : null}
          <p className="mt-1.5 inline-flex h-5 items-center rounded-staff-xs bg-staff-neutral-bg px-1.5 text-staff-xs font-medium text-staff-neutral-fg">
            {user.roleLabel}
          </p>
        </div>
        {children ? (
          <>
            <StaffMenuSeparator />
            {children}
          </>
        ) : null}
        {theme && onThemeChange ? (
          <>
            <StaffMenuSeparator />
            <StaffMenuLabel>Theme</StaffMenuLabel>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(next) => {
                const match = THEMES.find((option) => option.value === next);
                if (match) onThemeChange(match.value);
              }}
            >
              {THEMES.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  className="min-h-control-sm gap-2 rounded-staff-sm py-1.5 pr-2 pl-8 font-staff text-staff-sm text-staff-fg focus:bg-staff-hover [&>svg]:size-4 [&>svg]:text-staff-muted [&>span>span>svg]:size-2 [&>span>span>svg]:fill-staff-ink"
                >
                  {option.icon}
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        {shortcuts ? (
          <>
            <StaffMenuSeparator />
            {shortcuts.helpAvailable ? (
              <StaffMenuItem onSelect={shortcuts.openHelp} shortcut="?">
                <Keyboard aria-hidden />
                Keyboard shortcuts
              </StaffMenuItem>
            ) : null}
            <StaffMenuCheckboxItem
              checked={shortcuts.enabled}
              onCheckedChange={(checked) => shortcuts.setEnabled(checked === true)}
            >
              Single-key shortcuts
            </StaffMenuCheckboxItem>
          </>
        ) : null}
        {onSignOut || signOutHref ? (
          <>
            <StaffMenuSeparator />
            {signOutHref ? (
              <StaffMenuItem asChild>
                <a href={signOutHref}>
                  <LogOut aria-hidden />
                  Sign out
                </a>
              </StaffMenuItem>
            ) : (
              <StaffMenuItem {...(onSignOut ? { onSelect: onSignOut } : {})}>
                <LogOut aria-hidden />
                Sign out
              </StaffMenuItem>
            )}
          </>
        ) : null}
      </StaffMenuContent>
    </StaffMenu>
  );
}
