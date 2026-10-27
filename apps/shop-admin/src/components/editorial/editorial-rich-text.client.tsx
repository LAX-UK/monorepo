"use client";

import { isAllowedEditorialHref } from "@/lib/editorial-validation";
import { Field, RichTextField, type RichTextSpan } from "@auction/staff-ui";

const HREF_HINT = "Start with https://, mailto: or a single /, such as /visit.";

/**
 * A labelled formatted-text field for a block's paragraph or a FAQ answer: bold, italic and
 * links, saved as the block's own run format. Links are held to the same rule the block
 * validation applies, so a refused address is caught as it is typed.
 */
export function EditorialRichText({
  label,
  description,
  disabled,
  value,
  onChange,
  rows,
}: {
  label: string;
  description?: string;
  disabled: boolean;
  value: readonly RichTextSpan[];
  onChange: (spans: RichTextSpan[]) => void;
  rows?: number;
}) {
  return (
    <Field label={label} disabled={disabled} {...(description ? { description } : {})}>
      <RichTextField
        value={value}
        onChange={onChange}
        isSafeHref={isAllowedEditorialHref}
        hrefHint={HREF_HINT}
        {...(rows ? { rows } : {})}
      />
    </Field>
  );
}
