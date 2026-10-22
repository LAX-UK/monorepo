"use client";

import { Alert, AlertDescription, AlertTitle, Button } from "@auction/ui";

/**
 * Shown when a save was refused because someone else saved the same product first. Nothing was
 * written; the editor chooses whether to take their version or save over it.
 */
export function MerchandiseConflictBanner({
  savedAt,
  busy,
  onReload,
  onKeepMine,
}: {
  /** Time of the other save, already formatted. */
  savedAt: string;
  busy: boolean;
  onReload: () => void;
  onKeepMine: () => void;
}) {
  return (
    <Alert variant="warning">
      <AlertTitle className="text-base">Someone else saved this product at {savedAt}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Your changes have not been saved. Reload to see their version, which discards your
          changes, or keep your changes and save over theirs.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onReload}>
            Reload
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onKeepMine}>
            Keep my changes
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
