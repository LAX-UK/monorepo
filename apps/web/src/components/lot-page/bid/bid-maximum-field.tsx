"use client";

import type { BidDialogView } from "@/lib/lot-page/bid-dialog/bid-dialog-view";
import { Button, Field, NativeSelect, Notice, TextInput } from "@auction/ui/lax";
import { useRef } from "react";

type Maximum = NonNullable<BidDialogView["maximum"]>;

/**
 * The maximum: the next valid amounts to choose from, or any amount typed. A typed amount is
 * brought down to the nearest valid step and the bidder is told the figure before confirming; it
 * is never rounded up. A very large amount asks "are you sure?" first.
 */
export function BidMaximumField({
  maximum,
  busy,
  money,
  onChoose,
  onEntry,
  onType,
  onConfirmLarge,
}: {
  maximum: Maximum;
  busy: boolean;
  money: (amount: string) => string;
  onChoose: (value: string) => void;
  onEntry: (entry: "choose" | "type") => void;
  onType: (text: string) => void;
  onConfirmLarge: () => void;
}) {
  const typing = maximum.entry === "type";
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="grid gap-3">
      <Field label="Your maximum" error={maximum.error}>
        {typing ? (
          <TextInput
            ref={inputRef}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            leading={<span className="pr-1 text-lax-muted">£</span>}
            placeholder="For example 9,000"
            value={maximum.typedText}
            disabled={busy}
            onChange={(event) => onType(event.target.value)}
          />
        ) : (
          <NativeSelect
            value={maximum.value ?? ""}
            disabled={busy}
            onValueChange={onChoose}
            options={maximum.choices}
          />
        )}
      </Field>
      {/* Said aloud when the typed amount settles on a step. */}
      <output aria-live="polite" className="block text-lax-13 leading-5 text-lax-fg empty:hidden">
        {typing ? maximum.snapNote : null}
      </output>
      {maximum.large ? (
        <Notice
          tone="warning"
          alert
          title="That's a very large maximum"
          actions={
            <Button size="sm" variant="secondary" onClick={onConfirmLarge}>
              Yes, use {money(maximum.large.amount)}
            </Button>
          }
        >
          {money(maximum.large.amount)} is more than ten times the high estimate. Are you sure?
        </Notice>
      ) : null}
      <div className="flex">
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            onEntry(typing ? "choose" : "type");
            // The typed field takes focus as it appears.
            if (!typing) requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          {typing ? "Choose from the list" : "Type an amount"}
        </Button>
      </div>
    </div>
  );
}
