"use client";

import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

export type EditableCellProps = {
  value: string;
  onSave: (next: string) => Promise<ActionResult<void>>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

/** Click or Enter to edit; Esc cancels; optimistic update with undo via notify.action. */
export function EditableCell({
  value,
  onSave,
  placeholder = "—",
  className,
  inputClassName,
  ariaLabel = "Editable field",
  disabled = false,
}: EditableCellProps) {
  const [display, setDisplay] = useState(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDisplay(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      setDraft(display);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, display]);

  const cancel = useCallback(() => {
    setDraft(display);
    setEditing(false);
  }, [display]);

  const commit = useCallback(() => {
    const next = draft.trim();
    if (!next || next === display) {
      cancel();
      return;
    }
    const previous = display;
    setDisplay(next);
    setEditing(false);
    startTransition(async () => {
      const result = await onSave(next);
      if (!result.ok) {
        setDisplay(previous);
        notify.error(result.error);
        return;
      }
      notify.action("Saved", {
        description: `Reverted to “${previous}”`,
        onAction: () => {
          setDisplay(previous);
          void onSave(previous);
        },
      });
    });
  }, [cancel, display, draft, onSave]);

  if (disabled) {
    return (
      <span className={cn("font-body text-sm text-on-surface", className)}>
        {display || placeholder}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        disabled={pending}
        aria-label={ariaLabel}
        className={cn("h-8 font-body text-sm", inputClassName)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded px-1 -mx-1 text-left",
        "hover:bg-surface-container-high/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={`${ariaLabel}. Press Enter to edit.`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      <span className="truncate font-body text-sm text-on-surface">{display || placeholder}</span>
      <Pencil
        className="size-3 shrink-0 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </button>
  );
}
