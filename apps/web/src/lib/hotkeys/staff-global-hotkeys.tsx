"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { useHotkeyUi } from "@/lib/hotkeys/hotkey-provider";
import { useCommandPaletteHotkey } from "@/lib/hotkeys/use-command-palette-hotkey";
import { useHotkey } from "@/lib/hotkeys/use-hotkey";
import { useRouter } from "next/navigation";

/** Staff admin shell: g-chord navigation, palette, and help. */
export function StaffGlobalHotkeys() {
  const router = useRouter();
  const { openHelp } = useHotkeyUi();
  useCommandPaletteHotkey();

  const go = (href: string) => (event: KeyboardEvent) => {
    event.preventDefault();
    router.push(href);
  };

  useHotkey({
    id: "palette-open",
    keys: "$mod+k",
    label: "Command palette",
    description: "Open command palette",
    group: "Navigation",
    scope: "global",
    handler: (event) => {
      event.preventDefault();
      openCommandPalette();
    },
  });

  useHotkey({
    id: "hotkey-help",
    keys: "shift+/",
    label: "Keyboard shortcuts",
    description: "Show keyboard shortcuts",
    group: "Navigation",
    scope: "global",
    handler: (event) => {
      event.preventDefault();
      openHelp();
    },
  });

  useHotkey({
    id: "nav-home",
    keys: "g h",
    label: "Go home",
    description: "Go to staff home",
    group: "Go to",
    scope: "global",
    handler: go("/admin"),
  });

  useHotkey({
    id: "nav-lots",
    keys: "g l",
    label: "Lots",
    description: "Go to lots",
    group: "Go to",
    scope: "global",
    handler: go("/admin/lots"),
  });

  useHotkey({
    id: "nav-sales",
    keys: "g s",
    label: "Sales",
    description: "Go to sales",
    group: "Go to",
    scope: "global",
    handler: go("/admin/sales"),
  });

  useHotkey({
    id: "nav-clients",
    keys: "g c",
    label: "Clients",
    description: "Go to clients",
    group: "Go to",
    scope: "global",
    handler: go("/admin/clients"),
  });

  useHotkey({
    id: "nav-payments",
    keys: "g p",
    label: "Payments",
    description: "Go to payments",
    group: "Go to",
    scope: "global",
    handler: go("/admin/payments"),
  });

  useHotkey({
    id: "nav-payouts",
    keys: "g o",
    label: "Payouts",
    description: "Go to payouts",
    group: "Go to",
    scope: "global",
    handler: go("/admin/payouts"),
  });

  useHotkey({
    id: "nav-queue",
    keys: "g q",
    label: "Needs attention",
    description: "Go to staff home / needs attention",
    group: "Go to",
    scope: "global",
    handler: go("/admin"),
  });

  useHotkey({
    id: "nav-disputes",
    keys: "g d",
    label: "Disputes",
    description: "Go to payment disputes",
    group: "Go to",
    scope: "global",
    handler: go("/admin/disputes"),
  });

  useHotkey({
    id: "nav-finance-hub",
    keys: "g f",
    label: "Finance hub",
    description: "Go to finance home",
    group: "Go to",
    scope: "global",
    handler: go("/admin/finance"),
  });

  useHotkey({
    id: "nav-manual-review",
    keys: "g m",
    label: "Manual review",
    description: "Go to manual payment review",
    group: "Go to",
    scope: "global",
    handler: go("/admin/payments?manualReview=1"),
  });

  useHotkey({
    id: "nav-aml",
    keys: "g b",
    label: "AML screenings",
    description: "Go to AML screenings",
    group: "Go to",
    scope: "global",
    handler: go("/admin/compliance/aml"),
  });

  useHotkey({
    id: "nav-condition-reports",
    keys: "g r",
    label: "Condition reports",
    description: "Go to condition report requests",
    group: "Go to",
    scope: "global",
    handler: go("/admin/condition-reports"),
  });

  useHotkey({
    id: "nav-onboarding",
    keys: "g n",
    label: "Onboarding",
    description: "Go to onboarding issues",
    group: "Go to",
    scope: "global",
    handler: go("/admin/onboarding-issues"),
  });

  return null;
}
