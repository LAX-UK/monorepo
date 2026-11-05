import { ArtEditorialCard } from "@/components/editorial/art-editorial-card";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import { cn } from "@auction/ui";

/**
 * The home "What's on" section: the lead exhibition as a large card (image about 58% on the left,
 * the words and actions on the right) and a second as a smaller image card beside it. These are
 * the same editorial cards as the Exhibitions page; only the layout around them is the home's.
 * One exhibition fills the width on its own.
 */
export function ArtHomeWhatsOn({ cards }: { cards: readonly EditorialCardVm[] }) {
  const [lead, second] = cards;
  if (!lead) return null;
  return (
    <div
      className={cn(
        "grid gap-10 lg:gap-12",
        second && "lg:grid-cols-[minmax(0,5fr)_minmax(0,2fr)] lg:items-start",
      )}
    >
      <div className="self-start">
        <ArtEditorialCard card={lead} layout="split" aspect="landscape" priority />
      </div>
      {second ? <ArtEditorialCard card={second} aspect="landscape" /> : null}
    </div>
  );
}
