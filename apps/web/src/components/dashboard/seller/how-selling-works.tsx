const STEPS = [
  {
    title: "Tell us about the work",
    description: "Photos, size and what you know of its history. About 10 minutes.",
  },
  {
    title: "Our specialists review it",
    description: "We reply within 5 working days with an estimate and terms.",
  },
  {
    title: "It goes into a sale",
    description: "You accept the agreement, and we catalogue, market and sell it.",
  },
] as const;

/** Selling in three steps, under an empty Consignments list, so the first one is less unknown. */
export function HowSellingWorks() {
  return (
    <section aria-labelledby="how-selling-works" className="flex flex-col gap-3">
      <h2 id="how-selling-works" className="font-lax-display text-lax-18 font-semibold text-lax-fg">
        How selling works
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-col gap-1 rounded-lax-card border border-lax-line bg-lax-surface p-5"
          >
            <p className="text-lax-13 text-lax-muted">Step {index + 1}</p>
            <p className="text-lax-14 font-medium text-lax-fg">{step.title}</p>
            <p className="text-lax-14 text-lax-muted">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
