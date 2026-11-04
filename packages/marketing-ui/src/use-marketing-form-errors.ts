"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketingFormError } from "./marketing-form-error-summary.js";

type FieldMessages<Name extends string> = Partial<Record<Name, string>>;

/**
 * The error state of a consumer form, and the one rule for showing it:
 * - A form with one field shows its message under the field only. After a failed submit focus
 *   goes to the field, and the message is announced once: by the field's description when focus
 *   moves to it, or by `announce` (a live region) when the field already had focus.
 * - A form with two or more fields lists what to fix in a summary that takes focus, and shows each
 *   message under its field.
 *
 * `fail` records what a submit found and counts the attempt; `clear` drops one field's message as
 * the person edits it; `summary` is empty for a one-field form.
 */
export function useMarketingFormErrors<Name extends string>(
  fieldIds: Readonly<Record<Name, string>>,
) {
  const entries = Object.entries(fieldIds) as [Name, string][];
  const single = entries.length === 1;
  const onlyId = entries[0]?.[1];
  const [messages, setMessages] = useState<FieldMessages<Name>>({});
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [announce, setAnnounce] = useState(false);

  const fail = useCallback(
    (next: FieldMessages<Name>) => {
      setMessages(next);
      if (!Object.values(next).some(Boolean)) return;
      if (single) setAnnounce(document.activeElement?.id === onlyId);
      setFailedSubmits((count) => count + 1);
    },
    [single, onlyId],
  );

  const clear = useCallback((name: Name) => {
    setMessages((current) => {
      if (!current[name]) return current;
      const { [name]: _removed, ...rest } = current;
      return rest as FieldMessages<Name>;
    });
  }, []);

  useEffect(() => {
    if (single && failedSubmits > 0 && onlyId) document.getElementById(onlyId)?.focus();
  }, [single, failedSubmits, onlyId]);

  const summary: MarketingFormError[] = [];
  if (!single) {
    for (const [name, fieldId] of entries) {
      const message = messages[name];
      if (message) summary.push({ fieldId, message });
    }
  }

  return { messages, summary, failedSubmits, fail, clear, announce };
}
