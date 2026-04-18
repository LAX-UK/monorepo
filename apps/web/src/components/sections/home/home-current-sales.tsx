import { getServerSalesList } from "@/lib/data/http/sales.server";
import { formatMoney } from "@/lib/format-currency";
import Image from "next/image";
import Link from "next/link";

export async function HomeCurrentSales() {
  let rows: Awaited<ReturnType<typeof getServerSalesList>> = [];
  try {
    rows = await getServerSalesList({ status: "active", limit: 6 });
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  return (
    <section className="mb-20 px-4 md:px-10 lg:px-20">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary">
            Curated sessions
          </p>
          <h2 className="font-headline text-3xl tracking-tight text-on-surface md:text-4xl">
            Current sales
          </h2>
        </div>
        <Link
          href="/sales"
          className="font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
        >
          View all sales
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ sale, lots }) => {
          const img = sale.coverImages[0];
          const preview = lots.slice(0, 3);
          return (
            <Link
              key={sale.id}
              href={`/sales/${sale.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low/40 ring-1 ring-outline-variant/10 transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[16/9] bg-surface-container-low">
                {img ? (
                  <Image
                    src={img}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-headline text-2xl text-outline-variant">
                    ◆
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-inverse-surface/80 to-transparent px-4 pb-4 pt-12">
                  <p className="font-label text-[0.65rem] font-bold uppercase tracking-widest text-white/90">
                    {lots.length} lot{lots.length === 1 ? "" : "s"}
                  </p>
                  <h3 className="mt-1 font-headline text-xl text-white">{sale.title}</h3>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                {preview.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between border-b border-outline-variant/10 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="line-clamp-1 font-body text-sm text-on-surface">
                      {lot.title}
                    </span>
                    <span className="ml-2 shrink-0 font-label text-xs text-secondary">
                      {formatMoney(lot.currentPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
