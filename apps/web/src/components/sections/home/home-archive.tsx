import Image from "next/image";

const imgA =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAD4Nvrs5uB2uKmfg09-ougWoqAgw0yP_Ktw1QzEFkkoXRcCr2EHSphXK08CiCc-Zz2wifTsrSDswibojfttwhyjXcSgTDP-vhIFoARirretax_rO0OE_zJdy_705r3BCdIReOs_kbUkwup_Y19a-HU4m8uk1WYjF0zHPC79VSNfze1R-bKLN4K-GlWNtplmK84GHMqLIivcGeXAjmZ5Ts3txujGaK1agAQx1GsfUZjH-JcPsx5CLK0o--GeXDzkC0eGoJorm4j5UFA";
const imgB =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBPCDQin-8R4B8eocRze-KM78lgiCYvC-UuaU5q-EreySMFfAs5j9yg5Ob0A1PbXFpGvjIfGVx7n4DD_U96Hm1G0TecZ40ud_9Uz9W8TKfLq2t2wO0BZyDHGEKa19YPZmTtlZoq2QbJ88UQRXWHGK1pRrnyj9HKJxbhumcp9RpwefSz2jp5IQTanr2f87c4CpFSBVrMepvf-hQtRKgWEm33GQF8qPur_6d2dhMo7WqIxIvtcwpKcuiMWAJUw2AtuIzNgS5xnf5Upp_";

export function HomeArchive() {
  return (
    <section
      id="archive"
      className="overflow-hidden border-y border-stone-200 bg-stone-50 px-6 py-32 md:px-20"
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
            <div className="group flex cursor-pointer flex-col justify-between border-b border-stone-200 px-4 py-10 transition-colors duration-500 hover:bg-white md:flex-row md:items-center">
              <div>
                <h4 className="mb-2 font-headline text-2xl transition-all group-hover:italic">
                  The Winter Study
                </h4>
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Contemporary Masters 2024
                </p>
              </div>
              <div className="mt-4 text-right md:mt-0">
                <span className="font-headline text-lg text-stone-900">Sold: $420,000</span>
              </div>
            </div>
            <div className="group flex cursor-pointer flex-col justify-between border-b border-stone-200 px-4 py-10 transition-colors duration-500 hover:bg-white md:flex-row md:items-center">
              <div>
                <h4 className="mb-2 font-headline text-2xl transition-all group-hover:italic">
                  Anatomy of Light
                </h4>
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Minimalist Sculpture Series
                </p>
              </div>
              <div className="mt-4 text-right md:mt-0">
                <span className="font-headline text-lg text-stone-900">Sold: $115,000</span>
              </div>
            </div>
          </div>
          <button type="button" className="group mt-16 flex items-center space-x-4">
            <span className="border-b border-primary pb-1 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
              Access Sales Archive
            </span>
            <span className="material-symbols-outlined text-primary transition-transform duration-300 group-hover:translate-x-2">
              east
            </span>
          </button>
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
