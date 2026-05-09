"use client";

import { readReducedMotionOverride, setReducedMotionOverride } from "@/hooks/use-reduced-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { useEffect, useState } from "react";

type Override = "system" | "force-reduce" | "force-allow";

const OPTIONS: { value: Override; label: string; description: string }[] = [
  {
    value: "system",
    label: "Match system",
    description: "Follow your operating system's reduce-motion preference.",
  },
  {
    value: "force-reduce",
    label: "Reduce motion",
    description: "Disable non-essential animations across the site.",
  },
  {
    value: "force-allow",
    label: "Allow motion",
    description: "Always show animations, even when your OS requests reduced motion.",
  },
];

/** F9 — User-level Reduce Motion control. */
export function ReduceMotionCard() {
  const [value, setValue] = useState<Override>("system");

  useEffect(() => {
    setValue(readReducedMotionOverride());
  }, []);

  return (
    <Card className="rounded-xl border-outline-variant/15 shadow-none">
      <CardHeader>
        <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
          Motion
        </CardTitle>
        <CardDescription>
          Control how transitions and animations behave on this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => {
            const next = v as Override;
            setValue(next);
            setReducedMotionOverride(next);
          }}
          className="flex flex-col gap-3"
        >
          {OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`reduce-motion-${opt.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/40 p-3 has-[:checked]:border-primary"
            >
              <RadioGroupItem
                id={`reduce-motion-${opt.value}`}
                value={opt.value}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-body text-sm font-medium text-on-surface">{opt.label}</span>
                <span className="font-body text-xs text-on-surface-variant">{opt.description}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
