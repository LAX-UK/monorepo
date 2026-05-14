"use client";

import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { useClientOrigin } from "@/lib/dom/use-client-origin";
import { salePath } from "@/lib/seo/url";
import type { Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { CalendarPlus } from "lucide-react";
import { useCallback } from "react";

type Props = {
  sale: Sale;
  lotTitle: string;
  locationLine: string;
  className?: string;
};

function escapeIcsText(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,");
}

/** Client-only .ics download for the onsite sale window. */
export function AddSaleToCalendarButton({ sale, lotTitle, locationLine, className }: Props) {
  const onClick = useCallback(() => {
    const uid = `${sale.id}@lax.bid`;
    const dtStamp = `${new Date().toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z`;
    const start = new Date(sale.startTime);
    const end = new Date(sale.endTime);
    const fmt = (d: Date) =>
      Number.isFinite(d.getTime())
        ? `${d.toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z`
        : dtStamp;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LAX.BID//Lot//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${escapeIcsText(sale.title)} — ${escapeIcsText(lotTitle)}`,
      `DESCRIPTION:${escapeIcsText(`View catalogue: ${typeof window !== "undefined" ? window.location.origin : ""}${salePath(sale)}`)}`,
      `LOCATION:${escapeIcsText(locationLine || "See sale page")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sale.title.replaceAll(/[^\w-]+/g, "-").slice(0, 40)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lotTitle, locationLine, sale]);

  return (
    <Button type="button" variant="outline" className={className} onClick={onClick}>
      <CalendarPlus className="mr-2 size-4" aria-hidden />
      Add to calendar
    </Button>
  );
}

type MailProps = {
  sale: Sale;
  lotTitle: string;
  subjectPrefix?: string;
  className?: string;
};

export function RequestViewingMailtoButton({
  sale,
  lotTitle,
  subjectPrefix = "Viewing request",
  className,
}: MailProps) {
  // Empty during SSR + first client render so the rendered href matches across
  // both passes; mount effect fills in the absolute origin afterwards.
  const origin = useClientOrigin();
  const subject = encodeURIComponent(`${subjectPrefix}: ${sale.title} — ${lotTitle}`);
  const body = encodeURIComponent(
    `I would like to arrange a viewing or phone bidding for:\n\nSale: ${sale.title}\nLot: ${lotTitle}\nSale page: ${origin}${salePath(sale)}\n\n`,
  );
  const href = `mailto:${SITE_SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  return (
    <Button type="button" variant="secondary" className={className} asChild>
      <a href={href} suppressHydrationWarning>
        Request appointment
      </a>
    </Button>
  );
}
