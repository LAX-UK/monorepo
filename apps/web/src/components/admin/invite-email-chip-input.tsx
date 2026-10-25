"use client";

import {
  MAX_INVITE_BATCH,
  isValidInviteEmail,
  mergeInviteEmails,
  partitionInviteEmails,
} from "@/lib/admin/parse-invite-email-list";
import { StaffButton, TextInput } from "@auction/staff-ui";
import { X } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  emails: string[];
  onChange: (emails: string[]) => void;
  /** Reports what could not be added (an invalid address, the batch limit), or null once cleared. */
  onProblem?: (message: string | null) => void;
  disabled?: boolean;
  /** Read from the surrounding `Field` when omitted. */
  id?: string;
};

function normalizeToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[,;]+$/, "");
}

/**
 * Collects email addresses: type one and press Enter or a comma, or paste a list. Added
 * addresses sit below the field as removable chips. Addresses that are not valid are never
 * added; `onProblem` says which, so the surrounding field can show it.
 */
export function InviteEmailChipInput({ emails, onChange, onProblem, disabled = false, id }: Props) {
  const [draft, setDraft] = useState("");
  const atCap = emails.length >= MAX_INVITE_BATCH;
  const limitMessage = `You can invite up to ${MAX_INVITE_BATCH} people at a time.`;

  const addToken = useCallback(
    (raw: string) => {
      const token = normalizeToken(raw);
      if (!token) return;
      if (!isValidInviteEmail(token)) {
        onProblem?.(`${token} is not a valid email address.`);
        return;
      }
      const { merged, truncated } = mergeInviteEmails(emails, [token]);
      if (truncated) {
        onProblem?.(limitMessage);
        return;
      }
      onProblem?.(null);
      onChange(merged);
      setDraft("");
    },
    [emails, onChange, onProblem, limitMessage],
  );

  const addMany = useCallback(
    (raw: string) => {
      const { valid, invalid } = partitionInviteEmails(raw);
      const { merged, truncated } = mergeInviteEmails(emails, valid);
      if (valid.length > 0) {
        onChange(merged);
        setDraft("");
      }
      if (truncated) {
        onProblem?.(limitMessage);
      } else if (invalid.length > 0) {
        onProblem?.(
          invalid.length === 1
            ? `${invalid[0]} is not a valid email address.`
            : `These are not valid email addresses: ${invalid.join(", ")}.`,
        );
      } else {
        onProblem?.(null);
      }
    },
    [emails, onChange, onProblem, limitMessage],
  );

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email));
    onProblem?.(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        {...(id ? { id } : {})}
        type="text"
        inputMode="email"
        autoComplete="off"
        disabled={disabled || atCap}
        value={draft}
        placeholder={atCap ? "Batch limit reached" : "name@example.com"}
        onChange={(event) => {
          const value = event.target.value;
          if (value.includes(",") || value.includes(";")) {
            addMany(value);
            return;
          }
          setDraft(value);
          onProblem?.(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "," || event.key === ";") {
            event.preventDefault();
            addToken(draft);
            return;
          }
          if (event.key === "Backspace" && draft === "") {
            const last = emails.at(-1);
            if (last) removeEmail(last);
          }
        }}
        onBlur={() => {
          if (draft.trim()) addToken(draft);
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (!/[,;\s]/.test(text.trim())) return;
          event.preventDefault();
          addMany(text);
        }}
      />
      {emails.length > 0 ? (
        <ul aria-label="Added recipients" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {emails.map((email) => (
            <li
              key={email}
              className="inline-flex h-control-xs max-w-full items-center gap-0.5 rounded-staff-xs bg-staff-neutral-bg pl-2 text-staff-sm text-staff-neutral-fg"
            >
              <span className="truncate">{email}</span>
              <StaffButton
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={`Remove ${email}`}
                onClick={() => removeEmail(email)}
              >
                <X aria-hidden />
              </StaffButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
