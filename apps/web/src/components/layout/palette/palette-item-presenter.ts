import type {
  PaletteItem,
  PaletteItemKind,
  PaletteSection,
} from "@/components/layout/palette/types";
import { paymentStatusLabel } from "@/lib/admin/status-badge-variants";
import type { PaymentStatus } from "@auction/types";

export function paletteItemCommandValue(item: PaletteItem): string {
  return `${item.id} ${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`.trim();
}

export function paletteRecordHint(
  kind: PaletteItemKind | undefined,
  rawHint: string | undefined,
): string | undefined {
  if (!rawHint) return rawHint;
  if (kind !== "record") return rawHint;
  const paymentLabel = paymentStatusLabel[rawHint as PaymentStatus];
  if (paymentLabel) return paymentLabel;
  return rawHint.replaceAll("_", " ");
}

export function dedupePaletteSections(sections: readonly PaletteSection[]): PaletteSection[] {
  const seenHrefs = new Set<string>();
  const out: PaletteSection[] = [];

  for (const section of sections) {
    const items: PaletteItem[] = [];
    for (const item of section.items) {
      if (seenHrefs.has(item.href)) continue;
      seenHrefs.add(item.href);
      items.push(item);
    }
    if (items.length > 0) {
      out.push({ ...section, items });
    }
  }

  return out;
}

export function flattenPaletteSections(sections: readonly PaletteSection[]): PaletteItem[] {
  return sections.flatMap((section) => section.items);
}

export function findPaletteItemByHref(
  sections: readonly PaletteSection[],
  href: string,
): PaletteItem | undefined {
  for (const section of sections) {
    const match = section.items.find((item) => item.href === href);
    if (match) return match;
  }
  return undefined;
}

export function findPaletteItemById(
  sections: readonly PaletteSection[],
  id: string,
): PaletteItem | undefined {
  for (const section of sections) {
    const match = section.items.find((item) => item.id === id);
    if (match) return match;
  }
  return undefined;
}
