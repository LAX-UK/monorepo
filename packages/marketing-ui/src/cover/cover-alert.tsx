"use client";

import { cn } from "@auction/ui";
import { Button, TextInput } from "@auction/ui/lax";
import { ON_IMAGE_BUTTON, ON_IMAGE_FIELD, ON_IMAGE_FOCUS } from "./cover-on-image.js";
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
}: {
  alert: CoverAlert;
  submitLabel: string;
  /** The tone of the picture the field sits on; null on the page's own surface. */
  tone: CoverTone | null;
}) {
  const field = tone ? ON_IMAGE_FIELD[tone] : null;
  return (
    <form
      method="post"
      action={alert.action}
      className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center"
    >
      <TextInput
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
          tone && ON_IMAGE_FOCUS[tone],
        )}
        className={cn("max-md:text-base", field?.input)}
      />
      <Button
        type="submit"
        variant="primary"
        size="md"
        className={cn(
          "max-md:h-lax-control-lg max-md:w-full",
          tone && ON_IMAGE_BUTTON[tone],
          tone && ON_IMAGE_FOCUS[tone],
        )}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
