import { CheckCircle2, Shield, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const items: { icon: LucideIcon; label: string }[] = [
  { icon: CheckCircle2, label: "Certificate of authenticity" },
  { icon: Truck, label: "Insured white-glove shipping" },
  { icon: Shield, label: "Protected payment handling" },
];

export function ArtworkTrustStrip() {
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
