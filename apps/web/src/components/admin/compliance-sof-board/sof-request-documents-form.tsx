"use client";

import { requestSofDocumentsAction } from "@/lib/actions/compliance";
import { SOF_EVIDENCE_CHECKLIST } from "@/lib/admin/sof-evidence-checklist";
import { notify } from "@/lib/ui/notify";
import {
  ChoiceRow,
  Field,
  Notice,
  StaffButton,
  StaffCheckbox,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  caseId: string;
  disabled?: boolean;
};

/** Ask the buyer for evidence: the usual documents, any custom ones, and a note. */
export function SofRequestDocumentsForm({ caseId, disabled }: Props) {
  const router = useRouter();
  const groupId = useId();
  const [selected, setSelected] = useState<string[]>([...SOF_EVIDENCE_CHECKLIST.slice(0, 2)]);
  const [customType, setCustomType] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(type: string) {
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function addCustomType() {
    const trimmed = customType.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    setSelected((prev) => [...prev, trimmed]);
    setCustomType("");
  }

  function submit() {
    if (selected.length === 0) {
      setError("Choose at least one document to ask for.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("documentTypes", JSON.stringify(selected));
    fd.set("note", note);
    startTransition(async () => {
      const result = await requestSofDocumentsAction(fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      notify.success("Document request sent — awaiting buyer upload");
      router.refresh();
    });
  }

  const customOnly = selected.filter((t) => !SOF_EVIDENCE_CHECKLIST.includes(t as never));
  const busy = disabled || pending;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-1 text-staff-sm font-medium text-staff-fg">
          Documents to request from the buyer
        </legend>
        {SOF_EVIDENCE_CHECKLIST.map((type, index) => {
          const id = `${groupId}-${index}`;
          return (
            <ChoiceRow
              key={type}
              htmlFor={id}
              label={type}
              disabled={busy}
              control={
                <StaffCheckbox
                  id={id}
                  checked={selected.includes(type)}
                  disabled={busy}
                  onCheckedChange={() => toggle(type)}
                />
              }
            />
          );
        })}
        {customOnly.map((type) => (
          <div
            key={type}
            className="flex min-h-control-sm items-center justify-between gap-2 py-1.5 text-staff-sm text-staff-fg"
          >
            <span className="font-medium">{type}</span>
            <StaffButton
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => toggle(type)}
              aria-label={`Remove ${type}`}
            >
              Remove
            </StaffButton>
          </div>
        ))}
      </fieldset>

      <Field label="Another document" optional description="Add a type that is not listed above.">
        <div className="flex gap-2">
          <TextInput
            value={customType}
            disabled={busy}
            maxLength={500}
            onChange={(e) => setCustomType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomType();
              }
            }}
          />
          <StaffButton
            variant="secondary"
            disabled={busy || !customType.trim()}
            onClick={addCustomType}
          >
            Add
          </StaffButton>
        </div>
      </Field>

      <Field label="Note to the buyer" optional>
        <TextArea
          rows={3}
          value={note}
          disabled={busy}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {error ? (
        <Notice tone="danger" alert title="The request was not sent">
          {error}
        </Notice>
      ) : null}
      <div>
        <StaffButton variant="primary" loading={pending} disabled={disabled} onClick={submit}>
          Send document request
        </StaffButton>
      </div>
    </div>
  );
}
