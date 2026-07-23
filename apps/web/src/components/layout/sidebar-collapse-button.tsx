"use client";

import { ShellChromeIconButton } from "@/components/layout/shell-chrome-icon-button";
import { useSidebarState } from "@/components/layout/sidebar-state";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { cn } from "@auction/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";

export function SidebarCollapseButton() {
  const { collapsed, toggleCollapsed } = useSidebarState();
  const hydrated = useHydrated();
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const [shortcutHint, setShortcutHint] = useState("(Ctrl+B)");

  useEffect(() => {
    setShortcutHint(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "(⌘B)" : "(Ctrl+B)");
  }, []);

  const button = (
    <ShellChromeIconButton
      label={label}
      aria-expanded={!collapsed}
      onClick={toggleCollapsed}
      className={cn("shrink-0", collapsed ? "min-h-10 min-w-10" : "min-h-[52px] min-w-[52px]")}
    >
      <Icon className={cn(collapsed ? "size-5" : "size-6")} aria-hidden />
    </ShellChromeIconButton>
  );

  if (!hydrated) return button;

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={collapsed ? "right" : "bottom"}>
        {label} <span className="text-on-surface-variant">{shortcutHint}</span>
      </TooltipContent>
    </Tooltip>
  );
}
