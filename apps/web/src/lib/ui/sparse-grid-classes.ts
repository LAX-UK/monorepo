import { cn } from "@auction/ui";

type SparseGridOptions = {
  /** Tailwind classes when item count is 0 (usually unused — callers return early). */
  empty?: string;
  /** Single item: centered column. */
  single?: string;
  /** Two items: avoid jumping to 3+ columns. */
  pair?: string;
  /** Default multi-item grid classes. */
  multi: string;
};

/** Pick responsive grid classes based on how many items will render. */
export function sparseGridClasses(count: number, options: SparseGridOptions): string {
  if (count <= 0) return options.empty ?? options.multi;
  if (count === 1) {
    return cn("grid grid-cols-1 justify-items-center", options.single ?? "mx-auto w-full max-w-md");
  }
  if (count === 2) {
    return cn("grid grid-cols-1 sm:grid-cols-2", options.pair ?? options.multi);
  }
  return options.multi;
}
