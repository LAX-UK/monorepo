"use client";

import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";

type Props = {
  message: string;
  stepLabel?: string;
  onJumpToStep?: () => void;
};

/** Inline wizard validation summary with optional jump to the failing step. */
export function WizardValidationBanner({ message, stepLabel, onJumpToStep }: Props) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{stepLabel ? `Fix ${stepLabel}` : "Fix highlighted fields"}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{message}</p>
        {onJumpToStep ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10"
            onClick={onJumpToStep}
          >
            Go to step
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
