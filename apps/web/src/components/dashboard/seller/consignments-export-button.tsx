"use client";

import type { ConsignmentRecord } from "@/lib/seller/consignment-records";
import { consignmentsExportHref } from "@/lib/seller/consignments-csv";
import {
  type ConsignmentView,
  consignmentsInView,
  parseConsignmentsListQuery,
} from "@/lib/seller/consignments-list";
import { Button, ExportSheet } from "@auction/ui/lax";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/** Export on Consignments: the shared sheet, following the view and filters on screen. */
export function ConsignmentsExportButton({
  records,
  fallbackView,
}: {
  records: readonly ConsignmentRecord[];
  fallbackView: ConsignmentView;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const query = parseConsignmentsListQuery(Object.fromEntries(params.entries()), fallbackView);
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
        subject="consignments"
        viewCount={consignmentsInView(records, query).length}
        defaultFormat="csv"
        period={{ from: `${today.slice(0, 4)}-01-01`, to: today }}
        formats={[
          {
            value: "csv",
            label: "Spreadsheet (CSV)",
            description: "Opens in Excel and Numbers, with each reference, status and estimate.",
          },
        ]}
        onExport={(request) => {
          window.location.assign(consignmentsExportHref(query, request));
        }}
      />
    </>
  );
}
