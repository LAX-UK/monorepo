"use client";

import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { STAFF_PAGE_TITLE_CLASS, StaffButton, StaffTooltip, TextInput } from "@auction/staff-ui";
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * A record's page heading that staff may rename in place: the `h1` with a rename button beside it
 * (outside the heading). Renaming swaps in a field (Enter saves, Escape cancels) while the `h1`
 * stays in the page for screen readers. The new name shows at once and rolls back if saving
 * fails. Use with `PageHeader renderHeading`.
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

  // Follow the saved name when it changes on the server; not when editing ends, which would
  // undo the optimistic name before the save returns.
  useEffect(() => {
    setDisplay(value);
  }, [value]);

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
      <>
        <h1 className="sr-only">{display}</h1>
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
      </>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <h1 className={STAFF_PAGE_TITLE_CLASS}>{display}</h1>
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
