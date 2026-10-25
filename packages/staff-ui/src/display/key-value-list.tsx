"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { EmptyValue, isEmptyCellValue } from "../data/cells.js";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { TruncatedText } from "./truncated-text.js";

export type KeyValueItem = {
  label: string;
  value: React.ReactNode;
  /** Raw text to copy, e.g. a full reference behind a shortened one. Adds a copy button. */
  copyValue?: string;
  /** Right-aligned tabular figures, for amounts and counts. */
  numeric?: boolean;
};

/**
 * Facts about a record as label and value pairs: side by side (label 148px) when the list is at
 * least 384px wide, stacked when narrower. Empty values show an em dash so a missing fact is visible, not invisible.
 */
export function KeyValueList({
  items,
  className,
  columns = 1,
}: {
  items: readonly KeyValueItem[];
  className?: string;
  /** 2 lays pairs out in two columns on wide screens (summary cards). */
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={cn(
        // Sized by its container, not the window: label and value side by side when there is
        // room (a main column), stacked in a narrow side column or panel.
        "@container grid gap-x-8 text-staff-sm",
        columns === 2 ? "lg:grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="grid min-h-control-sm grid-cols-1 items-baseline gap-0.5 border-b border-staff-line-subtle py-1.5 last:border-b-0 @sm:grid-cols-[148px_minmax(0,1fr)] @sm:gap-4"
        >
          <dt className="text-staff-muted">{item.label}</dt>
          <dd
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-staff-fg",
              item.numeric && "tabular-nums",
            )}
          >
            {item.copyValue && typeof item.value === "string" ? (
              // A reference or address is one unbroken value: it shortens on one line, with the
              // full text in a tooltip and on the copy button, rather than breaking mid-word.
              <TruncatedText mode={item.value.includes("@") ? "middle" : "end"} className="min-w-0">
                {item.value}
              </TruncatedText>
            ) : (
              <span className="min-w-0 break-words">
                {isEmptyCellValue(item.value) ? <EmptyValue /> : item.value}
              </span>
            )}
            {item.copyValue ? <CopyButton value={item.copyValue} label={item.label} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <StaffButton
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="text-staff-subtle hover:text-staff-fg [&_svg]:size-3.5"
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </StaffButton>
  );
}
