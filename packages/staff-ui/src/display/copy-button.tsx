"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { COPY_BUTTON_COPY } from "./copy-button.copy.js";
import { TruncatedText } from "./truncated-text.js";

/** How long the tick stays before the icon returns to "copy" (PRD-4). */
export const COPY_CONFIRMATION_MS = 1500;

/**
 * Copies one reference in a click. A 24px ghost icon button that sits after the value; on success
 * the icon turns to a tick for 1.5s and a polite live region says "Order ID copied", so the result
 * is seen and heard. The button's name stays "Copy order ID" throughout, so the announcement is
 * not said twice. If the browser refuses, the icon turns to a red alert for the same 1.5s and the live region says so; the value stays selectable.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  /** The exact text put on the clipboard. */
  value: string;
  /** What is copied, in the words staff use: "Order ID". */
  label: string;
  className?: string;
}) {
  const [status, setStatus] = React.useState<"idle" | "copied" | "failed">("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  // Changes on every press so a repeat copy inside the window is announced again.
  const [presses, setPresses] = React.useState(0);
  const settle = (next: "copied" | "failed") => {
    setStatus(next);
    setPresses((count) => count + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), COPY_CONFIRMATION_MS);
  };
  const message =
    status === "copied"
      ? COPY_BUTTON_COPY.copied(label)
      : status === "failed"
        ? COPY_BUTTON_COPY.failed(label)
        : "";
  return (
    <>
      <StaffButton
        variant="ghost"
        size="icon-xs"
        aria-label={COPY_BUTTON_COPY.action(label)}
        onClick={() => {
          const write = navigator.clipboard?.writeText(value);
          if (!write) return settle("failed");
          void write.then(
            () => settle("copied"),
            () => settle("failed"),
          );
        }}
        data-copy-status={status}
        className={cn(
          "text-staff-subtle hover:text-staff-fg [&_svg]:size-3.5",
          status === "failed" && "text-staff-danger hover:text-staff-danger",
          className,
        )}
      >
        {status === "copied" ? (
          <Check aria-hidden />
        ) : status === "failed" ? (
          <CircleAlert aria-hidden />
        ) : (
          <Copy aria-hidden />
        )}
      </StaffButton>
      <output key={presses} aria-live="polite" className="sr-only">
        {message}
      </output>
    </>
  );
}

/**
 * A reference with its copy button: one line that shortens with the full text in a tooltip, in
 * the monospace the standard uses for IDs. For record headers, cells and menus.
 */
export function CopyableId({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      <TruncatedText mode="middle" className="min-w-0 font-mono text-staff-xs text-staff-fg">
        {value}
      </TruncatedText>
      <CopyButton value={value} label={label} />
    </span>
  );
}
