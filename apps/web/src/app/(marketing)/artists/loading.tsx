import { Skeleton } from "@auction/ui";

const CHIP_KEYS = ["chip-a", "chip-b", "chip-c", "chip-d", "chip-e"];
const RAIL_KEYS = ["rail-a", "rail-b", "rail-c", "rail-d"];
const CARD_KEYS = [
  "card-a",
  "card-b",
  "card-c",
  "card-d",
  "card-e",
  "card-f",
  "card-g",
  "card-h",
  "card-i",
];

export default function PublicArtistsDirectoryLoading() {
  return (
    <main id="main-content" className="pt-[var(--header-height)]">
      <section className="border-b border-outline-variant/15 bg-surface-container-lowest/40 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-10 w-72" />
          <Skeleton className="mt-4 h-4 w-2/3" />
          <Skeleton className="mt-8 h-12 w-full max-w-xl" />
          <div className="mt-6 flex flex-wrap gap-2">
            {CHIP_KEYS.map((k) => (
              <Skeleton key={k} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-12 md:px-12">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-6">
            <Skeleton className="h-3 w-24" />
            {RAIL_KEYS.map((k) => (
              <Skeleton key={k} className="h-7 w-full" />
            ))}
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {CARD_KEYS.map((k) => (
              <li
                key={k}
                className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface"
              >
                <Skeleton className="aspect-[4/5] w-full" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
