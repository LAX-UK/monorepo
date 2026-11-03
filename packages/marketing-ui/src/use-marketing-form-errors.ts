"use client";

import { useCallback, useState } from "react";
import type { MarketingFormError } from "./marketing-form-error-summary.js";

type FieldMessages<Name extends string> = Partial<Record<Name, string>>;

/**
 * The error state of a consumer form. `fail` records what a submit found and counts the attempt
 * (the summary takes focus once per failed submit); `clear` drops one field's message as the
 * person edits it; `summary` lists the messages in the order the fields appear on the page.
 */
export function useMarketingFormErrors<Name extends string>(
  fieldIds: Readonly<Record<Name, string>>,
) {
  const [messages, setMessages] = useState<FieldMessages<Name>>({});
  const [failedSubmits, setFailedSubmits] = useState(0);

  const fail = useCallback((next: FieldMessages<Name>) => {
    setMessages(next);
    if (Object.values(next).some(Boolean)) setFailedSubmits((count) => count + 1);
  }, []);

  const clear = useCallback((name: Name) => {
    setMessages((current) => {
      if (!current[name]) return current;
      const { [name]: _removed, ...rest } = current;
      return rest as FieldMessages<Name>;
    });
  }, []);

  const summary: MarketingFormError[] = [];
  for (const [name, fieldId] of Object.entries(fieldIds) as [Name, string][]) {
    const message = messages[name];
    if (message) summary.push({ fieldId, message });
  }

  return { messages, summary, failedSubmits, fail, clear };
}
