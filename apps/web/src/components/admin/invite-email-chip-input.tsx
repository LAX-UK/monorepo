"use client";

import {
  MAX_INVITE_BATCH,
  isValidInviteEmail,
  mergeInviteEmails,
  partitionInviteEmails,
} from "@/lib/admin/parse-invite-email-list";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

type Props = {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/,+$/, "");
}

export function InviteEmailChipInput({
  emails,
  onChange,
  disabled = false,
  id: idProp,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: Props) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);

  const atCap = emails.length >= MAX_INVITE_BATCH;

  const addToken = useCallback(
    (raw: string) => {
      const token = normalizeToken(raw);
      if (!token) return;
      setInlineError(null);

      if (!isValidInviteEmail(token)) {
        setInlineError(`Invalid email: ${token}`);
        return;
      }

      const { merged, truncated } = mergeInviteEmails(emails, [token]);
      if (truncated) {
        setInlineError(`Maximum ${MAX_INVITE_BATCH} recipients per batch`);
        return;
      }
      onChange(merged);
      setDraft("");
    },
    [emails, onChange],
  );

  const addMany = useCallback(
    (raw: string) => {
      setInlineError(null);
      const { valid, invalid } = partitionInviteEmails(raw);
      if (invalid.length > 0) {
        setInlineError(`Invalid email${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`);
      }
      if (valid.length === 0) return;

      const { merged, truncated } = mergeInviteEmails(emails, valid);
      onChange(merged);
      setDraft("");
      if (truncated) {
        setInlineError(`Maximum ${MAX_INVITE_BATCH} recipients per batch`);
      }
    },
    [emails, onChange],
  );

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email));
    setInlineError(null);
  };

  return (
    <div className="space-y-1.5">
      <fieldset
        disabled={disabled}
        className={cn(
          "m-0 flex min-h-11 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-input bg-surface-container-lowest p-3",
          "focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-1",
          ariaInvalid && "border-error",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {emails.map((email) => (
          <Badge key={email} variant="outline" className="gap-1 pr-1 font-body text-xs normal-case">
            {email}
            <button
              type="button"
              disabled={disabled}
              className="rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              aria-label={`Remove ${email}`}
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(email);
              }}
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="email"
          autoComplete="off"
          disabled={disabled || atCap}
          value={draft}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          placeholder={
            emails.length === 0
              ? "Type an email or paste a list"
              : atCap
                ? "Batch limit reached"
                : "Add another…"
          }
          className="min-w-[8rem] flex-1 border-0 bg-transparent font-body text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",") || v.includes(";")) {
              addMany(v);
              return;
            }
            setDraft(v);
            setInlineError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addToken(draft);
              return;
            }
            if (e.key === "," || e.key === ";") {
              e.preventDefault();
              addToken(draft);
              return;
            }
            if (e.key === "Backspace" && draft === "") {
              const last = emails.at(-1);
              if (last) removeEmail(last);
            }
          }}
          onBlur={() => {
            if (draft.trim()) addToken(draft);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!/[,;\s\n]/.test(text)) return;
            e.preventDefault();
            addMany(text);
          }}
        />
      </fieldset>
      {inlineError ? (
        <p className="font-body text-xs text-error" role="alert">
          {inlineError}
        </p>
      ) : null}
      {atCap ? (
        <p className="font-body text-xs text-on-surface-variant">
          Maximum {MAX_INVITE_BATCH} recipients per batch
        </p>
      ) : null}
    </div>
  );
}
