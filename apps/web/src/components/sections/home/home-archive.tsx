import Image from "next/image";
import Link from "next/link";

/** Stable Unsplash assets (Google aida-public tokens expire or 404 when truncated). */
const imgA =
  "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?auto=format&fit=crop&w=900&q=80";
const imgB =
  "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=900&q=80";

export function HomeArchive() {
  return (
    <section
      id="archive"
      className="overflow-hidden border-y border-outline-variant/30 bg-surface-container-low px-6 py-32 md:px-20"
    >
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-32">
        <div className="lg:col-span-5">
          <p className="mb-8 font-label text-[10px] font-bold uppercase tracking-[0.4em] text-primary">
            Archive & Legacy
          </p>
          <h2 className="mb-12 font-headline text-4xl font-light leading-tight md:text-6xl">
            Acquired by Selective <br />
            <span className="italic">Private Collections</span>
          </h2>
          <div>
            <div className="group flex cursor-pointer flex-col justify-between border-b border-outline-variant/30 px-4 py-10 transition-colors duration-500 hover:bg-surface-container-lowest md:flex-row md:items-center">
              <div>
                <h4 className="mb-2 font-headline text-2xl transition-all group-hover:italic">
                  The Winter Study
                </h4>
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
                  Contemporary Masters 2024
                </p>
              </div>
              <div className="mt-4 text-right md:mt-0">
                <span className="font-headline text-lg text-on-surface">Sold: $420,000</span>
              </div>
            </div>
            <div className="group flex cursor-pointer flex-col justify-between border-b border-outline-variant/30 px-4 py-10 transition-colors duration-500 hover:bg-surface-container-lowest md:flex-row md:items-center">
              <div>
                <h4 className="mb-2 font-headline text-2xl transition-all group-hover:italic">
                  Anatomy of Light
                </h4>
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
                  Minimalist Sculpture Series
                </p>
              </div>
              <div className="mt-4 text-right md:mt-0">
                <span className="font-headline text-lg text-on-surface">Sold: $115,000</span>
              </div>
            </div>
          </div>
          <Link href="/archive" className="group mt-16 inline-flex items-center space-x-4">
            <span className="border-b border-primary pb-1 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
              Access Sales Archive
            </span>
            <span className="material-symbols-outlined text-primary transition-transform duration-300 group-hover:translate-x-2">
              east
            </span>
          </Link>
        </div>
        <div className="lg:col-span-7">
          <div className="flex space-x-8 md:space-x-12">
            <div className="w-1/2 pt-20">
              <Image
                src={imgA}
                alt="Archive"
                width={400}
                height={500}
                className="h-[500px] w-full object-cover shadow-xl grayscale transition-all duration-700 hover:grayscale-0"
              />
            </div>
            <div className="w-1/2">
              <Image
                src={imgB}
                alt="Archive"
                width={400}
                height={600}
                className="h-[600px] w-full object-cover shadow-2xl transition-transform duration-700 hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
