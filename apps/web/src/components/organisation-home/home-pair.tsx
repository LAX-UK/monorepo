import type { ReactNode } from "react";

/**
 * Two Home sections side by side on desktop, a wide one and a narrow one on a shared pair of
 * tracks, so the narrow column lines up down the page. One column on phones. A pair with only one
 * of its sections gives it the full width; with neither, nothing is drawn.
 */
export function HomePair({ wide, narrow }: { wide: ReactNode | null; narrow: ReactNode | null }) {
  if (!wide && !narrow) return null;
  return (
    <div
      className={
        wide && narrow
          ? "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6"
          : "grid grid-cols-1 gap-8"
      }
    >
      {wide ? <div className="min-w-0">{wide}</div> : null}
      {narrow ? <div className="min-w-0">{narrow}</div> : null}
    </div>
  );
}
