"use client";

export function MediaReorderLiveRegion({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
