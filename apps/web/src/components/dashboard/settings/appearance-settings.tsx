"use client";

import { readReducedMotionOverride, setReducedMotionOverride } from "@/hooks/use-reduced-motion";
import { updateUiPreferencesAction } from "@/lib/actions/user-ui-preferences";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { notify } from "@/lib/ui/notify";
import { SegmentedControl } from "@auction/ui/lax";
import type { ThemePreference } from "@auction/validators";
import { useEffect, useState } from "react";

type Motion = "system" | "force-reduce" | "force-allow";

const THEMES: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match device" },
];

const MOTION: readonly { value: Motion; label: string }[] = [
  { value: "system", label: "Match device" },
  { value: "force-reduce", label: "Reduce" },
  { value: "force-allow", label: "Allow" },
];

/**
 * Appearance: the theme (follows the device unless chosen, saved to the profile so every device
 * agrees) and motion on this device.
 */
export function AppearanceSettings({ initialTheme }: { initialTheme: ThemePreference }) {
  const [theme, setTheme] = useState(initialTheme);
  const [motion, setMotion] = useState<Motion>("system");
  useEffect(() => setMotion(readReducedMotionOverride()), []);

  const chooseTheme = (next: ThemePreference) => {
    const previous = theme;
    setTheme(next);
    applyThemeDom(next);
    void updateUiPreferencesAction({ theme: next }).then((result) => {
      if (result.ok) return;
      setTheme(previous);
      applyThemeDom(previous);
      notify.error("We couldn't save your theme", { description: result.error });
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-lax-14 font-semibold text-lax-fg">Theme</p>
        <SegmentedControl
          label="Theme"
          size="md"
          value={theme}
          onValueChange={chooseTheme}
          options={THEMES}
          className="self-start"
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lax-14 font-semibold text-lax-fg">Motion on this device</p>
        <SegmentedControl
          label="Motion on this device"
          size="md"
          value={motion}
          onValueChange={(next) => {
            setMotion(next);
            setReducedMotionOverride(next);
          }}
          options={MOTION}
          className="self-start"
        />
      </div>
    </div>
  );
}
