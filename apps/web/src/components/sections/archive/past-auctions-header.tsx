type Props = {
  totalVolumeLabel: string;
};

export function PastAuctionsHeader({ totalVolumeLabel }: Props) {
  return (
    <header className="mx-auto mb-20 max-w-screen-2xl">
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <span className="mb-4 block font-label text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-primary">
            Archive
          </span>
          <h1 className="font-headline text-5xl tracking-tight text-on-surface md:text-7xl">
            Past Auctions
          </h1>
          <p className="mt-6 max-w-lg font-body font-light leading-relaxed text-on-surface-variant">
            An archival collection of distinguished sales and curated masterpieces. Explore our
            history of connecting collectors with extraordinary digital and physical assets.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-6 py-3 ring-1 ring-outline-variant/10">
            <span className="font-label text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-secondary">
              Total volume
            </span>
            <span className="font-headline text-lg text-primary">{totalVolumeLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
