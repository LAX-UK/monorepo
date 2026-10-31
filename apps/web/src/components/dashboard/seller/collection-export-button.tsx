"use client";

import { parseWorksListQuery, worksListSearch } from "@/lib/seller/collection-works";
import { Button, ExportSheet } from "@auction/ui/lax";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/** Export on Works: the shared sheet, following the search on screen. */
export function CollectionExportButton({
  counts,
  showPrice,
}: {
  counts: { view: number };
  showPrice: boolean;
}) {
  const [open, setOpen] = useState(false);
  const query = parseWorksListQuery(Object.fromEntries(useSearchParams().entries()));
  const today = new Date().toISOString().slice(0, 10);
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
        subject="works"
        viewCount={counts.view}
        defaultFormat="csv"
        period={{ from: `${today.slice(0, 4)}-01-01`, to: today }}
        formats={[
          {
            value: "csv",
            label: "Spreadsheet (CSV)",
            description: showPrice
              ? "Opens in Excel and Numbers, with where each work is and what was paid."
              : "Opens in Excel and Numbers, with where each work is.",
          },
        ]}
        onExport={(request) => {
          const params = new URLSearchParams(worksListSearch(query).replace(/^\?/, ""));
          params.set("scope", request.scope);
          if (request.from) params.set("from", request.from);
          if (request.to) params.set("to", request.to);
          window.location.assign(`/collection/export?${params.toString()}`);
        }}
      />
    </>
  );
}
