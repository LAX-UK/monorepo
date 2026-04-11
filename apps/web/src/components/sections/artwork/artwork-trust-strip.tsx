import { MaterialIcon } from "@/components/ui/material-icon";

const items = [
  { icon: "verified" as const, label: "Certificate of authenticity" },
  { icon: "local_shipping" as const, label: "Insured white-glove shipping" },
  { icon: "shield" as const, label: "Secure escrow settlement" },
];

export function ArtworkTrustStrip() {
  return (
    <div className="mt-10 flex flex-wrap gap-6 border-t border-outline-variant/15 pt-8">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-on-surface-variant">
          <MaterialIcon name={it.icon} className="text-lg text-primary" />
          <span className="font-label text-[9px] font-bold uppercase tracking-widest">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
