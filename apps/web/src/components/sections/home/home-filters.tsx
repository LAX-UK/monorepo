export function HomeFilters() {
  return (
    <section className="mb-20 px-4 md:px-10 lg:px-20">
      <div className="flex flex-col items-start justify-between border-b border-stone-200 pb-12 lg:flex-row lg:items-center">
        <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-3 lg:w-auto lg:gap-16">
          <div className="group">
            <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 transition-colors group-hover:text-primary">
              Artist
            </p>
            <select
              aria-label="Filter by artist"
              className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-8 font-headline text-2xl hover:text-stone-600 focus:ring-0"
            >
              <option>All Masters</option>
              <option>Elena Volkov</option>
              <option>Marcus Thorne</option>
            </select>
          </div>
          <div className="group">
            <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 transition-colors group-hover:text-primary">
              Medium
            </p>
            <select
              aria-label="Filter by medium"
              className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-8 font-headline text-2xl hover:text-stone-600 focus:ring-0"
            >
              <option>Any Medium</option>
              <option>Oil on Canvas</option>
              <option>Bronze Sculpture</option>
            </select>
          </div>
          <div className="group">
            <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 transition-colors group-hover:text-primary">
              Valuation
            </p>
            <select
              aria-label="Filter by valuation"
              className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-8 font-headline text-2xl hover:text-stone-600 focus:ring-0"
            >
              <option>Global Scale</option>
              <option>$10k — $50k</option>
              <option>$50k — $250k</option>
            </select>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-end lg:mt-0">
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">
            Inventory Status
          </span>
          <span className="mt-1 font-headline text-xl text-stone-900">
            Curated lots from live data
          </span>
        </div>
      </div>
    </section>
  );
}
