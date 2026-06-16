"use client";

import { requestSofDocumentsAction } from "@/lib/actions/compliance";
import { SOF_EVIDENCE_CHECKLIST } from "@/lib/admin/sof-evidence-checklist";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Input } from "@auction/ui/components/input";
import { Textarea } from "@auction/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  caseId: string;
  disabled?: boolean;
};

export function SofRequestDocumentsForm({ caseId, disabled }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([...SOF_EVIDENCE_CHECKLIST.slice(0, 2)]);
  const [customType, setCustomType] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    setError(null);
    setSuccess(null);
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
      setSuccess("Document request sent — awaiting buyer upload.");
      router.refresh();
    });
  }

  const customOnly = selected.filter((t) => !SOF_EVIDENCE_CHECKLIST.includes(t as never));

  return (
    <div className="space-y-3 rounded-lg border border-border-hairline p-4">
      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
        Request documents from buyer
      </p>
      <ul className="space-y-2">
        {SOF_EVIDENCE_CHECKLIST.map((type) => (
          <li key={type}>
            <div className="flex items-start gap-2 font-body text-sm">
              <Checkbox
                className="mt-1"
                checked={selected.includes(type)}
                disabled={disabled || pending}
                aria-label={type}
                onCheckedChange={() => toggle(type)}
              />
              <span>{type}</span>
            </div>
          </li>
        ))}
      </ul>

      {customOnly.length > 0 ? (
        <ul className="space-y-1 border-t border-border-hairline pt-2">
          {customOnly.map((type) => (
            <li key={type} className="flex items-center justify-between gap-2 font-body text-sm">
              <span>{type}</span>
              <button
                type="button"
                className="text-xs text-link underline"
                disabled={disabled || pending}
                onClick={() => toggle(type)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-0 flex-1 font-body text-sm"
          placeholder="Add custom document type"
          value={customType}
          disabled={disabled || pending}
          maxLength={500}
          onChange={(e) => setCustomType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomType();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || pending || !customType.trim()}
          onClick={addCustomType}
        >
          Add
        </Button>
      </div>

      <Textarea
        className="font-body text-sm"
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
      {success ? <p className="font-body text-xs text-success">{success}</p> : null}
      {error ? <p className="font-body text-xs text-error">{error}</p> : null}
    </div>
  );
}
