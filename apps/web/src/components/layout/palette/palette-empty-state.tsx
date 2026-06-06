import { CommandEmpty } from "@auction/ui";

type Props = {
  query: string;
};

export function resolvePaletteEmptyMessage(query: string): string | null {
  const q = query.trim();
  if (q.length === 1) {
    return "No pages match. Type one more character to search records.";
  }
  if (q.length >= 2) {
    return `No results for “${q}”. Try a page name, lot title, or paste a record ID.`;
  }
  return null;
}

export function PaletteEmptyState({ query }: Props) {
  const message = resolvePaletteEmptyMessage(query);
  if (!message) return null;

  return <CommandEmpty className="px-4 py-6 font-body text-sm">{message}</CommandEmpty>;
}
