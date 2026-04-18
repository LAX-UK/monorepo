import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function SaleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bundle = await getServerSaleWithLots(id).catch(() => null);
  if (!bundle) notFound();

  const { sale, lots } = bundle;
  const hero = sale.coverImages[0];

  return (
    <main id="main-content" className="bg-surface pb-24 pt-28">
      <div className="relative mx-auto max-w-[1920px]">
        <div className="relative h-[42vh] min-h-[280px] w-full bg-surface-container-low md:h-[48vh]">
          {hero ? (
            <Image
              src={hero}
              alt=""
              fill
              priority
              placeholder="blur"
              blurDataURL={TINY_IMAGE_BLUR}
              className="object-cover"
              sizes="100vw"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-10 md:px-20">
            <nav className="mb-4 font-label text-xs uppercase tracking-widest text-on-surface-variant">
              <Link href="/sales" className="hover:text-primary">
                Sales
              </Link>
              <span className="mx-2">/</span>
              <span className="text-on-surface">{sale.title}</span>
            </nav>
            <h1 className="max-w-4xl font-headline text-4xl tracking-tight text-on-surface md:text-6xl">
              {sale.title}
            </h1>
            <p className="mt-4 max-w-2xl font-body text-on-surface-variant">
              {sale.description ?? "Curated catalog — explore individual lots below."}
            </p>
            <p className="mt-4 font-label text-xs uppercase tracking-widest text-secondary">
              {sale.status} · Closes {sale.endTime.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-screen-2xl px-6 pt-16 md:px-20">
        <h2 className="mb-8 font-headline text-2xl">Catalog</h2>
        {lots.length === 0 ? (
          <p className="text-on-surface-variant">No lots in this sale yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {lots.map((lot) => {
              const img = lot.images[0];
              return (
                <li key={lot.id}>
                  <Link
                    href={`/artwork/${lot.id}`}
                    className="group block overflow-hidden rounded-lg bg-surface-container-low/50 ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[4/5] bg-surface-container-low">
                      {img ? (
                        <Image
                          src={img}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : null}
                      {lot.lotNumber != null ? (
                        <span className="absolute left-3 top-3 rounded-sm bg-surface/90 px-2 py-1 font-label text-[0.65rem] font-bold uppercase tracking-wider">
                          Lot {lot.lotNumber}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h3 className="font-headline text-lg text-on-surface group-hover:text-primary">
                        {lot.title}
                      </h3>
                      <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
                        {lot.status} · {formatMoney(lot.currentPrice)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
