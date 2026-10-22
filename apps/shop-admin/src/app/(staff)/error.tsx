"use client";

import { Alert, AlertDescription, AlertTitle, Button } from "@auction/ui";
import Link from "next/link";

export default function StaffError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Alert variant="destructive" className="max-w-xl">
      <AlertTitle className="text-base">Something went wrong</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-4">
        <p>
          This page could not be shown. Try again, or go back to the overview and sign in again if
          it keeps happening.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="md" onClick={() => reset()}>
            Retry
          </Button>
          <Button variant="outline" size="md" asChild>
            <Link href="/overview">Back to overview</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
