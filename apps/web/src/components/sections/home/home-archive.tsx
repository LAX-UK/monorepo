import Image from "next/image";
import Link from "next/link";

/** Stable Unsplash sources (see next.config remotePatterns). */
const imgPortrait =
  "https://images.unsplash.com/photo-1578321272176-b7bbc0679853?auto=format&fit=crop&w=800&q=80";
const imgGallery =
  "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80";

const blurDataURL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";

const showcaseRows = [
  {
    title: "The Winter Study",
    series: "Contemporary Masters 2024",
    sold: "$420,000",
  },
  {
    title: "Anatomy of Light",
    series: "Minimalist Sculpture Series",
    sold: "$115,000",
  },
] as const;

export function HomeArchive() {
  return (
    <section
      id="archive"
      className="overflow-hidden border-y border-outline-variant/30 bg-surface-container-low px-6 py-32 md:px-20"
    >
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-32">
        <div className="lg:col-span-5">
          <p className="mb-8 font-label text-xs font-bold uppercase tracking-[0.35em] text-primary">
            Archive & Legacy
          </p>
          <h2 className="mb-12 font-headline text-4xl font-light leading-tight md:text-6xl">
            Acquired by Selective <br />
            <span className="italic">Private Collections</span>
          </h2>
          <div>
            {showcaseRows.map((row) => (
              <Link
                key={row.title}
                href="/archive"
                className="group flex flex-col justify-between border-b border-outline-variant/30 px-4 py-10 transition-colors duration-500 hover:bg-surface-container-lowest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:flex-row md:items-center"
                aria-label={`${row.title}, ${row.series}, sold for ${row.sold}. Open past auctions archive.`}
              >
                <div>
                  <h3 className="mb-2 font-headline text-2xl transition-all group-hover:italic">
                    {row.title}
                  </h3>
                  <p className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
                    {row.series}
                  </p>
                </div>
                <div className="mt-4 text-right md:mt-0">
                  <span className="font-headline text-lg text-on-surface">Sold: {row.sold}</span>
                </div>
              </Link>
            ))}
          </div>
          <Link
            href="/archive"
            className="group mt-16 inline-flex items-center space-x-4 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="border-b border-primary pb-1 font-label text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Access Sales Archive
            </span>
            <span className="material-symbols-outlined text-primary transition-transform duration-300 group-hover:translate-x-2 motion-reduce:transform-none">
              east
            </span>
          </Link>
        </div>
        <div className="lg:col-span-7">
          <div className="flex space-x-8 md:space-x-12">
            <div className="w-1/2 pt-20">
              <Image
                src={imgPortrait}
                alt="Portrait in a studio setting"
                width={400}
                height={500}
                sizes="(max-width: 1024px) 50vw, 35vw"
                priority
                placeholder="blur"
                blurDataURL={blurDataURL}
                className="h-[500px] w-full object-cover shadow-xl grayscale transition-all duration-700 hover:grayscale-0 motion-reduce:transition-none motion-reduce:hover:grayscale"
              />
            </div>
            <div className="w-1/2">
              <Image
                src={imgGallery}
                alt="Gallery wall with framed artworks"
                width={400}
                height={600}
                sizes="(max-width: 1024px) 50vw, 40vw"
                placeholder="blur"
                blurDataURL={blurDataURL}
                className="h-[600px] w-full object-cover shadow-2xl transition-transform duration-700 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
