import { buildSaleroomHeroStats } from "@/components/sections/saleroom/hero/saleroom-hero-copy";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";

type Props = {
  hero: SaleHeroVM;
};

export function SaleroomHeroStatsRow({ hero }: Props) {
  const stats = buildSaleroomHeroStats(hero);

  return (
    <dl className="fade-up-d4 flex flex-wrap gap-8 md:gap-10">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="mb-1 font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            {label}
          </dt>
          <dd className="font-headline text-xl font-semibold text-on-surface">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
