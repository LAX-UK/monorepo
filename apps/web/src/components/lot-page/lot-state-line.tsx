import { splitStateText } from "@/lib/lot-page/split-state-text";
import type { LotStatusTone, StateLine, StateLineIcon } from "@auction/domain";
import { cn } from "@auction/ui";
import { Check, CircleAlert } from "lucide-react";
import type { ComponentType } from "react";

/** Tone never stands alone: every line also has words and a shape. */
const TONE_CLASS: Readonly<Record<LotStatusTone, string>> = {
  neutral: "bg-lax-neutral-bg text-lax-neutral-fg",
  info: "bg-lax-info-bg text-lax-info-fg",
  success: "bg-lax-success-bg text-lax-success-fg",
  warning: "bg-lax-warning-bg text-lax-warning-fg",
  danger: "bg-lax-danger-bg text-lax-danger-fg",
};

function DotIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-4 place-items-center", className)}>
      <span className="size-2 rounded-full bg-current" />
    </span>
  );
}

const ICONS: Readonly<Record<StateLineIcon, ComponentType<{ className?: string }>>> = {
  tick: Check,
  alert: CircleAlert,
  dot: DotIcon,
};

/**
 * One line about the viewer: where they stand, or what limits them. A tinted block with the
 * shape first, the claim in 14px medium and the detail beneath in 13px.
 */
export function LotStateLine({ line, className }: { line: StateLine; className?: string }) {
  const Icon = ICONS[line.icon];
  const { title, detail } = splitStateText(line.text);
  return (
    <div
      className={cn(
        "grid grid-cols-[1rem_minmax(0,1fr)] gap-2.5 rounded-lg p-3",
        TONE_CLASS[line.tone],
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="m-0 text-lax-14 leading-5">
        <span className="block font-medium">{title}</span>
        {detail ? <span className="block text-lax-13 leading-5">{detail}</span> : null}
      </p>
    </div>
  );
}
