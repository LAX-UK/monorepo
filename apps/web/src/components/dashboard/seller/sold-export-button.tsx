"use client";

import { parseSoldListQuery } from "@/lib/seller/sold-and-payouts-list";
import { Button, ExportSheet } from "@auction/ui/lax";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Export on Sold & payouts: the shared sheet for the tab on screen. Sold lots export with the
 * year chosen ("this view") or every year; payouts export as one line each.
 */
export function SoldExportButton({ counts }: { counts: { sold: number; payouts: number } }) {
  const [open, setOpen] = useState(false);
  const query = parseSoldListQuery(Object.fromEntries(useSearchParams().entries()));
  const sold = query.view === "sold";
  return (
    <>
      <Button
        icon={<Download aria-hidden />}
        onClick={() => setOpen(true)}
        className="max-md:hidden"
      >
        Export
      </Button>
      <ExportSheet<"csv">
        open={open}
        onOpenChange={setOpen}
        subject={sold ? "sold works" : "payouts"}
        viewCount={sold ? counts.sold : counts.payouts}
        defaultFormat="csv"
        formats={[
          {
            value: "csv",
            label: "Spreadsheet (CSV)",
            description: sold
              ? "Opens in Excel and Numbers, with the hammer, what you receive and the payout."
              : "Opens in Excel and Numbers, with each payout's sales, fees and amount.",
          },
        ]}
        onExport={(request) => {
          const params = new URLSearchParams({ tab: query.view, scope: request.scope });
          if (request.scope === "view" && query.year) params.set("year", String(query.year));
          window.location.assign(`/selling/payouts/export?${params.toString()}`);
        }}
      />
    </>
  );
}
