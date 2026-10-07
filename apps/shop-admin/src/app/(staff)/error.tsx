"use client";

export default function StaffError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        Try again or sign in again if the problem persists.
      </p>
      <button type="button" className="text-sm underline" onClick={() => reset()}>
        Retry
      </button>
    </div>
  );
}
