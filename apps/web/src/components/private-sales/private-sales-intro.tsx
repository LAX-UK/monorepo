import { SITE_CONTACT_EMAIL, SITE_TELEPHONE_DISPLAY, SITE_TELEPHONE_HREF } from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui/lib/utils";
import { Clock, Lock, Phone, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const POINTS: readonly { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <Lock aria-hidden className="size-[18px]" strokeWidth={1.75} />,
    title: "Confidential from the start",
    body: "No public listing, no published price. Only the people the deal needs know about it.",
  },
  {
    icon: <Clock aria-hidden className="size-[18px]" strokeWidth={1.75} />,
    title: "On your timetable",
    body: "No sale calendar. You agree the price before anything is sold.",
  },
  {
    icon: <ShieldCheck aria-hidden className="size-[18px]" strokeWidth={1.75} />,
    title: "Handled like any LAX sale",
    body: "Identity checks, a proper invoice and secure payment, then payment to the seller with a statement.",
  },
];

/** The three promises of a private sale. */
export function PrivateSalesPoints({ className }: { className?: string }) {
  return (
    <ul className={cn("m-0 grid list-none gap-3.5 p-0", className)}>
      {POINTS.map((point) => (
        <li key={point.title} className="flex gap-3">
          <span className="mt-0.5 text-on-surface-variant">{point.icon}</span>
          <p className="m-0 font-body text-sm leading-6 text-on-surface-variant">
            <strong className="block font-semibold text-on-surface">{point.title}</strong>
            {point.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** For people who would rather speak: the page's existing email and telephone line. */
export function PrivateSalesContactLines({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border-hairline bg-surface-container-lowest px-4 py-3.5 font-body text-sm leading-5 text-on-surface-variant",
        className,
      )}
    >
      <Phone aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
      <p className="m-0">
        <strong className="block font-semibold text-on-surface">Prefer to talk?</strong>
        Email{" "}
        <a href={`mailto:${SITE_CONTACT_EMAIL}`} className={MARKETING_PROSE_LINK}>
          {SITE_CONTACT_EMAIL}
        </a>{" "}
        or call{" "}
        <a href={`tel:${SITE_TELEPHONE_HREF}`} className={MARKETING_PROSE_LINK}>
          {SITE_TELEPHONE_DISPLAY}
        </a>{" "}
        on weekdays, 09:00 to 18:00 GMT.
      </p>
    </div>
  );
}
