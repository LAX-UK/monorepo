"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";
import { useField } from "./field.js";
import { fieldBox } from "./input.js";

/** Characters that finish a token while typing; pasted text is split on any whitespace too. */
const SEPARATOR = /[,;\s]+/;

/** Splits typed or pasted text into tokens, dropping blanks. */
export function splitTokens(text: string): string[] {
  return text
    .split(SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export type TokenInputProps = {
  /** The tokens so far, in the order they were added. */
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  /** Why a token is not valid ("Not an email address"), or `null`; invalid chips are marked. */
  validate?: (token: string) => string | null;
  /** How each token is kept: lower-cased emails, trimmed names. */
  normalise?: (token: string) => string;
  placeholder?: string;
  disabled?: boolean;
  /** The remove button's name for a chip: `Remove ${token}` by default. */
  removeLabel?: (token: string) => string;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Several short values in one field, each a chip: email addresses to invite, tags. A comma,
 * semicolon, space or Enter finishes a value; pasting a list adds every item; Backspace in an
 * empty field takes the last chip back into the text so it can be corrected. Duplicates are
 * ignored. An invalid chip is drawn with the danger edge and its reason is its accessible
 * description, so it can be seen, heard and fixed in place.
 */
export function TokenInput({
  value,
  onValueChange,
  validate,
  normalise = (token) => token,
  placeholder,
  disabled,
  removeLabel = (token) => `Remove ${token}`,
  id,
  className,
  ...aria
}: TokenInputProps) {
  const field = useField();
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const reasonId = React.useId();
  const isDisabled = disabled ?? field?.disabled ?? false;
  const invalid = value.some((token) => validate?.(token));

  const add = (tokens: readonly string[]) => {
    const next = [...value];
    for (const raw of tokens) {
      const token = normalise(raw);
      if (token && !next.includes(token)) next.push(token);
    }
    if (next.length !== value.length) onValueChange(next);
  };

  const commitDraft = () => {
    const tokens = splitTokens(draft);
    setDraft("");
    add(tokens);
  };

  const remove = (token: string) => {
    onValueChange(value.filter((item) => item !== token));
    inputRef.current?.focus();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a pointer convenience; the input itself is focusable.
    <div
      className={cn(
        fieldBox,
        "min-h-lax-control-md flex-wrap gap-1.5 py-1.5 text-lax-14",
        "has-[[aria-invalid=true]]:border-lax-danger",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((token) => {
        const reason = validate?.(token) ?? null;
        return (
          <span
            key={token}
            data-invalid={reason ? "" : undefined}
            className={cn(
              "inline-flex h-7 max-w-full items-center gap-1 rounded-lax-badge border bg-lax-sunken pr-0.5 pl-2 text-lax-13 text-lax-fg",
              reason ? "border-lax-danger" : "border-lax-line",
            )}
          >
            <span className="truncate">{token}</span>
            {reason ? <span className="sr-only">: {reason}</span> : null}
            <button
              type="button"
              disabled={isDisabled}
              aria-label={removeLabel(token)}
              onClick={(event) => {
                event.stopPropagation();
                remove(token);
              }}
              className="lax-focus grid size-6 shrink-0 place-items-center rounded-lax-badge text-lax-muted transition-colors hover:bg-lax-hover hover:text-lax-fg active:bg-lax-pressed disabled:cursor-not-allowed"
            >
              <X aria-hidden strokeWidth={1.75} />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        id={id ?? field?.controlId}
        value={draft}
        disabled={isDisabled}
        placeholder={value.length === 0 ? placeholder : undefined}
        aria-invalid={invalid || field?.invalid || undefined}
        aria-describedby={
          [field?.describedBy, invalid ? reasonId : null].filter(Boolean).join(" ") || undefined
        }
        {...aria}
        onChange={(event) => {
          const text = event.target.value;
          // A separator typed (or pasted) finishes everything before it.
          if (SEPARATOR.test(text)) {
            const parts = text.split(SEPARATOR);
            const rest = parts.pop() ?? "";
            add(parts.map((part) => part.trim()).filter(Boolean));
            setDraft(rest);
          } else {
            setDraft(text);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && draft.trim()) {
            event.preventDefault();
            commitDraft();
          } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
            event.preventDefault();
            const last = value[value.length - 1] as string;
            onValueChange(value.slice(0, -1));
            setDraft(last);
          }
        }}
        onBlur={commitDraft}
        className="h-7 min-w-[8rem] flex-1 bg-transparent outline-none placeholder:text-lax-subtle disabled:cursor-not-allowed"
      />
      {invalid ? (
        <span id={reasonId} className="sr-only">
          Some entries need fixing.
        </span>
      ) : null}
    </div>
  );
}
