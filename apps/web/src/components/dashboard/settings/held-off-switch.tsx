"use client";

import { Switch } from "@auction/ui/lax/switch";
import { ReasonTooltip } from "@auction/ui/lax/tooltip";
import { useId } from "react";

/**
 * A switch that is off and cannot be changed here, and says why. It stays focusable (a disabled
 * control can't be), so the tooltip opens on focus, and the reason is its description for a
 * screen reader. The inner switch is only the picture.
 */
export function HeldOffSwitch({ label, reason }: { label: string; reason: string }) {
  const reasonId = useId();
  return (
    <ReasonTooltip reason={reason}>
      <span
        role="switch"
        aria-checked="false"
        aria-disabled="true"
        aria-label={label}
        aria-describedby={reasonId}
        tabIndex={0}
        className="lax-focus inline-flex rounded-lax-control"
      >
        <Switch aria-hidden tabIndex={-1} checked={false} disabled />
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      </span>
    </ReasonTooltip>
  );
}
