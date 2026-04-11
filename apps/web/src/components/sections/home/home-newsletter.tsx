export function HomeNewsletter() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-32 text-center md:px-20">
      <h2 className="mb-10 font-headline text-4xl font-light italic md:text-5xl">
        The Curator&apos;s Letter
      </h2>
      <p className="mb-16 max-w-3xl mx-auto text-lg font-light leading-relaxed text-stone-500 md:text-xl">
        Join our private circle for exclusive access to viewing rooms, early lot registration, and
        distinguished market analysis delivered with care.
      </p>
      <div className="relative mx-auto max-w-xl">
        <input
          type="email"
          placeholder="EMAIL FOR INVITATION"
          className="w-full border-0 border-b border-stone-300 bg-transparent py-6 px-0 font-label text-xs font-bold uppercase tracking-[0.4em] placeholder:text-stone-400 focus:border-primary focus:outline-none focus:ring-0"
          aria-label="Email for invitation"
        />
        <button
          type="button"
          className="absolute right-0 top-1/2 -translate-y-1/2 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary transition-all duration-500 hover:tracking-[0.5em]"
        >
          Subscribe
        </button>
      </div>
    </section>
  );
}
