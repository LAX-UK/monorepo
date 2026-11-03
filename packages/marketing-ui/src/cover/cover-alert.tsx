"use client";

import { cn } from "@auction/ui";
import { Button, TextInput } from "@auction/ui/lax";
import { type FormEvent, useId } from "react";
import { marketingEmailError } from "../marketing-email-error.js";
import { useMarketingFormErrors } from "../use-marketing-form-errors.js";
import {
  ON_IMAGE_DARK_THEME,
  ON_IMAGE_ERROR_MESSAGE,
  ON_IMAGE_FIELD,
  onImageButton,
  onImageFocus,
} from "./cover-on-image.js";
import type { CoverAlert, CoverTone } from "./cover-types.js";

/**
 * The alert field: an email address and one button, side by side with 8px between them on a
 * desktop and stacked, full width and 44px high on a phone. On a picture it takes the picture's
 * tone (a tinted pane for the field, a white button with dark text and a white focus ring on a
 * dark tone); on the page it is the kit's own field and primary button.
 */
export function CoverAlertField({
  alert,
  submitLabel,
  tone,
  swap = false,
}: {
  alert: CoverAlert;
  submitLabel: string;
  /** The tone of the picture the field sits on; null on the page's own surface. */
  tone: CoverTone | null;
  /** The plate switches to light type in the dark theme. */
  swap?: boolean;
}) {
  const field = tone ? ON_IMAGE_FIELD[tone] : null;
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const errors = useMarketingFormErrors({ email: fieldId });
  const error = errors.messages.email ?? null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const email = new FormData(event.currentTarget).get("email");
    const problem = marketingEmailError(typeof email === "string" ? email : "");
    errors.fail(problem ? { email: problem } : {});
    if (problem) event.preventDefault();
  }

  return (
    <form
      method="post"
      action={alert.action}
      noValidate
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-2 md:w-auto"
    >
      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
        <TextInput
          id={fieldId}
          invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={() => errors.clear("email")}
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          aria-label={alert.fieldLabel}
          placeholder={alert.fieldLabel}
          size="md"
          boxClassName={cn(
            "max-md:h-lax-control-lg md:w-[280px]",
            field?.box,
            tone && swap && ON_IMAGE_DARK_THEME.field.box,
            tone && onImageFocus(tone, swap),
          )}
          className={cn(
            "max-md:text-base",
            field?.input,
            tone && swap && ON_IMAGE_DARK_THEME.field.input,
          )}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          className={cn(
            "max-md:h-lax-control-lg max-md:w-full",
            tone && onImageButton(tone, swap),
            tone && onImageFocus(tone, swap),
          )}
        >
          {submitLabel}
        </Button>
      </div>
      {error ? (
        <p
          id={errorId}
          {...(errors.announce ? { role: "alert" } : {})}
          className={ON_IMAGE_ERROR_MESSAGE}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
