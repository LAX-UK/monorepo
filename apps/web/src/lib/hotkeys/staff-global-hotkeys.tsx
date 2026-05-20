"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { useHotkeyUi } from "@/lib/hotkeys/hotkey-provider";
import { useHotkey } from "@/lib/hotkeys/use-hotkey";
import { useRouter } from "next/navigation";

/** Staff admin shell: g-chord navigation, palette, and help. */
export function StaffGlobalHotkeys() {
  const router = useRouter();
  const { openHelp } = useHotkeyUi();

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
    label: "My queue",
    description: "Go to staff home / my queue",
    group: "Go to",
    scope: "global",
    handler: go("/admin"),
  });

  return null;
}
