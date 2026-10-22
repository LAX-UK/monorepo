"use client";

import type { FieldErrors } from "@/lib/form-validation";
import { useEffect, useRef } from "react";
import { fieldControlId } from "./form-field";

type FormErrorSummaryProps = {
  scope: string;
  errors: FieldErrors;
};

/**
 * Lists every failed field and takes focus whenever a new set of errors arrives, so keyboard and
 * screen-reader users land on the problem instead of hunting for it. Each entry moves focus to its
 * field because an in-page anchor alone would not focus Radix controls.
 */
export function FormErrorSummary({ scope, errors }: FormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a fresh errors object means a new failed submit, even when the messages repeat
  useEffect(() => {
    ref.current?.focus();
  }, [errors]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${scope}-error-summary-title`}
      className="rounded-md border border-error p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <h4 id={`${scope}-error-summary-title`} className="font-medium text-error">
        There is a problem
      </h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {Object.entries(errors).map(([name, message]) => {
          const id = fieldControlId(scope, name);
          return (
            <li key={name}>
              <a
                href={`#${id}`}
                className="underline underline-offset-2"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(id)?.focus();
                }}
              >
                {message}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
