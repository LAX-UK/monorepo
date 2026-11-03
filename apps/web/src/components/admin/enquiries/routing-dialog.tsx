"use client";

import { saveEnquiryRoutingAction } from "@/lib/actions/admin/admin-enquiries";
import {
  type RoutingDraft,
  type RoutingRow,
  draftFromRules,
  draftKey,
  routingChanged,
  routingRows,
  rulesFromDraft,
  unroutedWarning,
} from "@/lib/admin/enquiries/enquiry-routing-rows";
import type { EnquiryAssignee, EnquiryRule } from "@/lib/data/http/admin-enquiries.schema";
import { notify } from "@/lib/ui/notify";
import { EnumSelect, Notice, StaffButton, StaffDialog } from "@auction/staff-ui";
import { AlertTriangle } from "@auction/staff-ui/icons";
import { useEffect, useId, useMemo, useRef, useState } from "react";

const NO_ONE = "none";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: EnquiryRule[];
  assignees: EnquiryAssignee[];
};

/**
 * Who gets a new enquiry first: one specialist per department, and a fallback for everything
 * else, including buying privately. Anyone can reassign an enquiry afterwards. A department with
 * no specialist says where its enquiries go instead. Every change is audited by the API.
 */
export function RoutingDialog({ open, onOpenChange, rules, assignees }: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const rows = useMemo(() => routingRows(rules), [rules]);
  const [draft, setDraft] = useState<RoutingDraft>(() => draftFromRules(rules));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // A fresh draft each time the dialog opens, from the table as it is now.
  useEffect(() => {
    if (!open) return;
    setDraft(draftFromRules(rules));
    setFailure(null);
  }, [open, rules]);

  const people = assignees.map((person) => ({ value: person.id, label: person.name }));
  const hasFallback = Boolean(draft[draftKey(null)]);
  const nameOf = (userId: string) =>
    assignees.find((person) => person.id === userId)?.name ?? "a former colleague";
  const warning = unroutedWarning(rows, draft, nameOf);
  const changed = routingChanged(rows, draft, rules);

  async function save() {
    setBusy(true);
    setFailure(null);
    const result = await saveEnquiryRoutingAction(rulesFromDraft(rows, draft));
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      notify.success("Routing saved");
    } else {
      setFailure(result.error);
    }
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title="Enquiry routing"
      description="Who gets a new enquiry first. Anyone can reassign it afterwards."
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton
            variant="primary"
            loading={busy}
            {...(changed ? {} : { disabledReason: "Change a specialist first." })}
            onClick={() => void save()}
          >
            Save routing
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <Notice tone="danger" alert title="Routing wasn't saved">
            {failure}
          </Notice>
        ) : null}
        {warning ? (
          <p
            className={`m-0 flex items-start gap-2 text-staff-sm ${hasFallback ? "text-staff-muted" : "text-staff-danger-fg"}`}
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {warning}
          </p>
        ) : null}
        <ul aria-label="Routing by department" className="m-0 flex list-none flex-col p-0">
          {rows.map((row) => (
            <RoutingLine
              key={draftKey(row.slug)}
              row={row}
              inputId={`${ids}-${draftKey(row.slug)}`}
              value={draft[draftKey(row.slug)] || NO_ONE}
              options={[
                { value: NO_ONE, label: row.slug === null ? "No fallback" : "No specialist" },
                ...people,
              ]}
              disabled={busy}
              // A department with no specialist is only a problem when nothing catches it.
              invalid={!hasFallback && row.slug !== null && !draft[draftKey(row.slug)]}
              onChange={(next) =>
                setDraft((current) => ({
                  ...current,
                  [draftKey(row.slug)]: next === NO_ONE ? "" : next,
                }))
              }
            />
          ))}
        </ul>
      </div>
    </StaffDialog>
  );
}

function RoutingLine({
  row,
  inputId,
  value,
  options,
  disabled,
  invalid,
  onChange,
}: {
  row: RoutingRow;
  inputId: string;
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-staff-line py-2 last:border-b-0">
      <label htmlFor={inputId} className="min-w-0 text-staff-sm text-staff-fg">
        {row.label}
      </label>
      <EnumSelect
        id={inputId}
        aria-label={`Specialist for ${row.label}`}
        value={value}
        options={options}
        disabled={disabled}
        invalid={invalid}
        onValueChange={onChange}
        className="w-[200px] shrink-0"
      />
    </li>
  );
}
