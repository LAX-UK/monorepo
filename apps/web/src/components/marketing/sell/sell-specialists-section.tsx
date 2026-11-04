import { MarketingSection } from "@/components/marketing/marketing-section";
import { MediaImage } from "@/components/ui/media-image";
import { SELL_SECTION_IDS } from "@/lib/marketing/sell-landing";
import type { SellSpecialist } from "@/lib/marketing/sell-specialists";

type Props = { specialists: readonly SellSpecialist[] };

/** The people who value and sell your work. Hidden until there is someone to show. */
export function SellSpecialistsSection({ specialists }: Props) {
  const shown = specialists.filter((person) => person.photoUrl.trim() !== "");
  if (shown.length === 0) return null;
  return (
    <MarketingSection id={SELL_SECTION_IDS.specialists} heading="Our specialists">
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {shown.map((person) => (
          <li key={person.id} className="min-w-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-container-low">
              <MediaImage
                src={person.photoUrl}
                alt={person.name}
                label="Specialist portrait"
                className="absolute inset-0 size-full"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <p className="mt-3 font-headline text-base font-medium text-on-surface">
              {person.name}
            </p>
            <p className="font-body text-sm text-on-surface-variant">{person.role}</p>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
