"use client";

import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { StaffButton, StaffTooltip, TextInput } from "@auction/staff-ui";
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * A record's page title that staff may rename in place. The title reads as plain text at the
 * page-title size; a rename button beside it swaps in a field (Enter saves, Escape cancels). The
 * new name shows at once and rolls back if saving fails.
 */
export function StaffEditableTitle({
  value,
  label,
  editable,
  onSave,
}: {
  value: string;
  /** What is being renamed, for the button's name: "lot", "client". */
  label: string;
  editable: boolean;
  onSave: (next: string) => Promise<ActionResult<void>>;
}) {
  const [display, setDisplay] = useState(value);
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDisplay(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const cancel = () => {
    setDraft(display);
    setEditing(false);
  };

  const commit = () => {
    const next = draft.trim();
    if (!next || next === display) return cancel();
    const previous = display;
    setDisplay(next);
    setEditing(false);
    startTransition(async () => {
      const result = await onSave(next);
      if (!result.ok) {
        setDisplay(previous);
        notify.error(result.error);
      }
    });
  };

  if (editing) {
    return (
      <form
        className="flex w-full max-w-xl items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        <TextInput
          ref={inputRef}
          aria-label={`Rename ${label}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          boxClassName="flex-1"
          className="text-staff-lg font-semibold"
        />
        <StaffButton type="submit" variant="primary" size="icon-md" aria-label="Save name">
          <Check aria-hidden />
        </StaffButton>
        <StaffButton variant="ghost" size="icon-md" aria-label="Cancel renaming" onClick={cancel}>
          <X aria-hidden />
        </StaffButton>
      </form>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{display}</span>
      {editable ? (
        <StaffTooltip label={`Rename ${label}`}>
          <StaffButton
            variant="ghost"
            size="icon-xs"
            aria-label={`Rename ${label}`}
            onClick={() => {
              setDraft(display);
              setEditing(true);
            }}
            className="text-staff-subtle hover:text-staff-fg [&_svg]:size-3.5"
          >
            <Pencil aria-hidden />
          </StaffButton>
        </StaffTooltip>
      ) : null}
    </span>
  );
}
