"use client";

import { CLIENT_MESSAGE_MAX } from "@/lib/admin/legal-entity-client-message";
import { Field, TextArea } from "@auction/staff-ui";
import { useId, useState } from "react";

type Props = {
  /** Called with what is typed, so the caller sends it with the action. */
  onChange: (value: string) => void;
  /** What the message is for, in the words of the status being set. */
  purpose: string;
  disabled?: boolean;
};

/**
 * The optional message to an organisation's members, kept apart from the staff reason: the
 * reason is for the audit log, this is read by the client. Empty means their screens keep the
 * standard wording.
 */
export function ClientMessageField({ onChange, purpose, disabled = false }: Props) {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <Field
      id={id}
      label="Message to the organisation (shown to its members)"
      description={`Optional. Members read this on their Home page ${purpose}. Don't include internal notes.`}
    >
      <TextArea
        value={value}
        maxLength={CLIENT_MESSAGE_MAX}
        rows={3}
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          onChange(event.target.value);
        }}
      />
    </Field>
  );
}
