"use client";

import { bidsInView, parseBidsListQuery } from "@/lib/bid/bids-list";
import { bidsExportHref } from "@/lib/bid/my-bids-csv";
import type { MyBidsVm } from "@/lib/bid/my-bids.vm";
import { Button, ExportSheet } from "@auction/ui/lax";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Export on Bids: the shared sheet, which follows the view and filters on screen by default.
 * The file is a CSV with who placed each bid, the maximum and the hammer price.
 */
export function BidsExportButton({ vm }: { vm: MyBidsVm | null }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const query = parseBidsListQuery(Object.fromEntries(params.entries()));
  const view = query.view === "sales" ? "active" : query.view;
  const viewCount = vm ? bidsInView(vm.cardsByTab[view], query).length : 0;
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
        subject="bids"
        viewCount={viewCount}
        defaultFormat="csv"
        period={{ from: `${today.slice(0, 4)}-01-01`, to: today }}
        formats={[
          {
            value: "csv",
            label: "Spreadsheet (CSV)",
            description: "Opens in Excel and Numbers, with who placed each bid.",
          },
        ]}
        onExport={(request) => {
          window.location.assign(bidsExportHref({ ...query, view }, request));
        }}
      />
    </>
  );
}
