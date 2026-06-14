"use client";

import { requestSofDocumentsAction } from "@/lib/actions/compliance";
import { SOF_EVIDENCE_CHECKLIST } from "@/lib/admin/sof-evidence-checklist";
import { Button } from "@auction/ui/components/button";
import { useState, useTransition } from "react";

type Props = {
  caseId: string;
  disabled?: boolean;
};

export function SofRequestDocumentsForm({ caseId, disabled }: Props) {
  const [selected, setSelected] = useState<string[]>([...SOF_EVIDENCE_CHECKLIST.slice(0, 2)]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(type: string) {
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("documentTypes", JSON.stringify(selected));
    fd.set("note", note);
    startTransition(async () => {
      const result = await requestSofDocumentsAction(fd);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-hairline p-4">
      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
        Request documents from buyer
      </p>
      <ul className="space-y-2">
        {SOF_EVIDENCE_CHECKLIST.map((type) => (
          <li key={type}>
            <label className="flex cursor-pointer items-start gap-2 font-body text-sm">
              <input
                type="checkbox"
                checked={selected.includes(type)}
                disabled={disabled || pending}
                onChange={() => toggle(type)}
                className="mt-1"
              />
              <span>{type}</span>
            </label>
          </li>
        ))}
      </ul>
      <textarea
        className="w-full rounded-md border border-border-hairline bg-surface px-3 py-2 font-body text-sm"
        rows={3}
        placeholder="Optional note to the buyer"
        value={note}
        disabled={disabled || pending}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={disabled || pending || selected.length === 0}
        onClick={submit}
      >
        Send document request
      </Button>
      {error ? <p className="font-body text-xs text-error">{error}</p> : null}
    </div>
  );
}
