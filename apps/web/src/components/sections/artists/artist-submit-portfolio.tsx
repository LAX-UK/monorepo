import Link from "next/link";

const benefits = [
  "Global exhibition exposure",
  "Direct collector networking",
  "Curated monograph support",
] as const;

export function ArtistSubmitPortfolio() {
  return (
    <section className="border-t border-outline-variant/20 bg-surface-dim/30 px-8 py-32 md:px-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-16 md:flex-row">
        <div className="w-full md:w-1/2">
          <h2 className="mb-6 font-headline text-4xl text-on-surface md:text-5xl">
            Shape the future of <br />
            <span className="italic text-primary">The Digital Curator</span>
          </h2>
          <p className="mb-8 max-w-md font-body leading-relaxed text-secondary">
            We are constantly seeking visionary artists whose work challenges conventions and pushes
            the boundaries of their respective mediums.
          </p>
          <ul className="space-y-4">
            {benefits.map((text) => (
              <li key={text} className="flex items-center gap-4">
                <span
                  className="material-symbols-outlined select-none text-primary"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
                  aria-hidden
                >
                  check_circle
                </span>
                <span className="font-label text-sm font-semibold uppercase tracking-wide text-on-surface">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full bg-surface-container-lowest p-10 shadow-2xl md:w-1/2 md:p-12">
          <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
            Ready to submit your portfolio? Our concierge team reviews every inquiry. Use the
            contact page to share your name, medium, and a link to your work—we will follow up by
            email.
          </p>
          <Link
            href="/contact"
            className="inline-flex w-full items-center justify-center bg-on-surface py-4 font-label text-xs font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-primary"
          >
            Go to contact
          </Link>
        </div>
      </div>
    </section>
  );
}
