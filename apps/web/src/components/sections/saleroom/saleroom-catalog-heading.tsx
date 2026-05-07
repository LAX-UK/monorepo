type Props = {
  totalLots: number;
};

/** Single Figma “LOTS (n)” strip — catalog-first (no tab switcher).
 */
export function SaleroomCatalogHeading({ totalLots }: Props) {
  return (
    <div
      aria-label="Catalog"
      className="mb-12 flex h-auto w-full items-baseline justify-start gap-1.5 rounded-none border-b border-brand-100 bg-transparent pb-2.5 dark:border-outline-variant/30"
    >
      <h2 className="font-['DM_Sans',sans-serif] text-lg font-semibold uppercase leading-[21px] text-nav-text dark:text-on-surface">
        Lots
      </h2>
      <span className="font-['DM_Sans',sans-serif] text-lg font-semibold uppercase leading-[21px] text-nav-text dark:text-on-surface">
        ({totalLots})
      </span>
    </div>
  );
}
