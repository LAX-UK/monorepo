import { CheckCircle2, Shield, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
const items: { icon: LucideIcon; label: string }[] = [
  { icon: CheckCircle2, label: "Certificate of authenticity" },
  { icon: Truck, label: "Insured white-glove shipping" },
  { icon: Shield, label: "Protected payment handling" },
];

type Props = {
  /** Tighter grid for the bid card. */
  compact?: boolean;
};

export function ArtworkTrustStrip({ compact = false }: Props) {
  if (compact) {
    return (
      <ul
        className="grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-3"
        aria-label="Buyer assurances"
      >
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.label} className="flex min-w-0 items-start gap-2 text-on-surface-variant">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="font-label text-[0.65rem] font-bold uppercase leading-tight tracking-widest text-on-surface-variant">
                {it.label}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mt-10 flex flex-wrap gap-6 border-t border-outline-variant/15 pt-8">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="flex items-center gap-2 text-on-surface-variant">
            <Icon className="size-5 text-primary" aria-hidden />
            <span className="font-label text-xs font-bold uppercase tracking-widest">
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
