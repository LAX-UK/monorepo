"use client";

import { updateUiPreferencesAction } from "@/lib/actions/user-ui-preferences";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import type { ThemePreference } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Always use the light theme." },
  { value: "dark", label: "Dark", hint: "Always use the dark theme." },
  { value: "system", label: "Follow system", hint: "Match your device appearance setting." },
];

export function AppearanceSettingsForm({ initialTheme }: { initialTheme: ThemePreference }) {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setTheme(initialTheme);
  }, [initialTheme]);

  return (
    <RadioGroup
      value={theme}
      onValueChange={(value) => {
        const next = value as ThemePreference;
        setTheme(next);
        applyThemeDom(next);
        startTransition(() => {
          void updateUiPreferencesAction({ theme: next }).then((res) => {
            if (res.ok) router.refresh();
          });
        });
      }}
      className="grid gap-4"
      disabled={pending}
    >
      {OPTIONS.map((o) => (
        <div
          key={o.value}
          className="flex items-start gap-3 rounded-lg border border-outline-variant/30 p-4"
        >
          <RadioGroupItem
            value={o.value}
            id={`theme-${o.value}`}
            aria-describedby={`hint-${o.value}`}
          />
          <div className="grid gap-1">
            <Label
              htmlFor={`theme-${o.value}`}
              className="cursor-pointer font-label text-xs font-bold uppercase tracking-widest"
            >
              {o.label}
            </Label>
            <p id={`hint-${o.value}`} className="text-sm text-on-surface-variant">
              {o.hint}
            </p>
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}
