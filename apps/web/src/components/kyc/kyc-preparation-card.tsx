import { Clock3, IdCard, Smartphone, Sun } from "lucide-react";

export function KycPreparationCard({ compact = false }: { compact?: boolean }) {
  const checklist = [
    { icon: IdCard, label: "Photo ID ready" },
    { icon: Sun, label: "Good lighting" },
    { icon: Smartphone, label: "Phone or camera nearby" },
  ] as const;

  return (
    <section
      className={
        compact
          ? "rounded-xl border border-primary/20 bg-primary-container/20 p-5"
          : "mx-auto max-w-2xl rounded-xl border border-primary/20 bg-primary-container/20 p-6 sm:p-8"
      }
      aria-labelledby="kyc-preparation-heading"
    >
      <div className="flex items-center justify-center gap-2 text-on-surface">
        <Clock3 className="size-5 text-primary" aria-hidden />
        <h2 id="kyc-preparation-heading" className="font-headline text-base font-semibold">
          Usually about 2 minutes
        </h2>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {checklist.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 text-center"
          >
            <Icon className="size-6 text-primary" aria-hidden />
            <span className="font-body text-sm font-medium text-on-surface">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center font-body text-sm leading-6 text-on-surface-variant">
        Veriff guides each check. LAX receives the verification result, not a copy of your identity
        document in this browser flow.
      </p>
    </section>
  );
}
